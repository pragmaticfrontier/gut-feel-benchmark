import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { experimental_decide, type Experimental_DecisionState } from 'ai';
import { makeContestant, type Contestant } from './contestants.ts';
import { METADATA_KEY } from './llm-decision-model.ts';
import { loadPack } from './packs/index.ts';
import type { Item, Prediction } from './types.ts';

/**
 * These contestants run when `--models` is not given, in this order. Each chat
 * model runs with reasoning off and with high reasoning, and the expensive
 * high-reasoning entries run last, so a run that hits a budget stops on them.
 */
export const DEFAULT_ROSTER = [
  'decide:typesafe-ai/jev',
  'decide:microsoft/microsoft-decision-1',
  'decide:openai/gpt-6-luna-decisions',
  'llm:anthropic/claude-opus-5.5',
  'llm:openai/gpt-6.1-sol',
  'llm:google/gemini-3.8-flash',
  'llm:google/gemini-3.8-flash@high',
  'llm:openai/gpt-6.1-sol@high',
  'llm:anthropic/claude-opus-5.5@high',
];

export interface RunOptions {
  contestants: string[];
  packs: string[];
  dataDir: string;
  runDir: string;
  limit?: number;
  concurrency?: number;
  timeoutMs?: number;
  log?: (line: string) => void;
}

export function predictionsFile(runDir: string): string {
  return join(runDir, 'predictions.jsonl');
}

export function networkFile(runDir: string): string {
  return join(runDir, 'network.jsonl');
}

export interface NetworkSample {
  at: string;
  medianMs: number;
  samplesMs: number[];
}

export function readNetwork(runDir: string): NetworkSample[] {
  const file = networkFile(runDir);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as NetworkSample);
}

/**
 * Times five requests to AI Gateway that do no model work, after one to open
 * the connection. The median is the floor that the network and Gateway add to
 * every latency in the run, so readers can tell it apart from model time.
 */
export async function measureNetwork(url = 'https://ai-gateway.vercel.sh/v1/models', count = 5): Promise<NetworkSample> {
  const once = async () => {
    const started = performance.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const elapsed = performance.now() - started;
    await res.body?.cancel();
    return elapsed;
  };
  await once();
  const samplesMs: number[] = [];
  for (let i = 0; i < count; i++) samplesMs.push(await once());
  const sorted = samplesMs.slice().sort((a, b) => a - b);
  return { at: new Date().toISOString(), medianMs: sorted[Math.floor(count / 2)], samplesMs };
}

function formatWarning(warning: unknown): string {
  const w = warning as Record<string, unknown>;
  return [w.type, w.feature ?? w.setting, w.details ?? w.message].filter((x) => typeof x === 'string' && x).join(': ');
}

export function readPredictions(runDir: string): Prediction[] {
  const file = predictionsFile(runDir);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Prediction);
}

/**
 * Sends one item to one contestant as a Jev request and times the round trip.
 * Retries are off: a retried call would hide its first failure inside a
 * longer latency. A failed item is retried on the next run instead.
 */
export async function decideOne(contestant: Contestant, item: Item, timeoutMs = 120_000): Promise<Prediction> {
  const base = { contestant: contestant.id, pack: item.pack, itemId: item.id };
  const started = performance.now();
  try {
    const result = await experimental_decide({
      model: contestant.model,
      state: item.state as Experimental_DecisionState,
      questions: {
        answer: {
          type: 'boolean',
          instructions: item.question.instructions,
          ...(item.question.criteria ? { criteria: item.question.criteria } : {}),
        },
      },
      maxRetries: 0,
      abortSignal: Number.isFinite(timeoutMs) ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    const latencyMs = performance.now() - started;
    const reasoningTokens = result.providerMetadata?.[METADATA_KEY]?.reasoningTokens;
    const warnings = (result.warnings ?? []).map(formatWarning);
    return {
      ...base,
      probability: result.answers.answer.probability,
      latencyMs,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      ...(typeof reasoningTokens === 'number' ? { reasoningTokens } : {}),
      ...(warnings.length ? { warnings } : {}),
      at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...base,
      probability: null,
      latencyMs: performance.now() - started,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      at: new Date().toISOString(),
    };
  }
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  });
  await Promise.all(lanes);
}

/**
 * Runs every contestant over every item and appends one prediction per line.
 * Runs resume: an item with a successful prediction is never sent again.
 */
export async function runBenchmark(opts: RunOptions): Promise<void> {
  const log = opts.log ?? console.log;
  const items = opts.packs.flatMap((pack) => loadPack(opts.dataDir, pack).slice(0, opts.limit ?? Infinity));
  const contestants = opts.contestants.map((spec) => makeContestant(spec, items));

  if (contestants.some((c) => c.kind !== 'mock') && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error('Set AI_GATEWAY_API_KEY (in the environment or .env) to reach models on Vercel AI Gateway.');
  }

  mkdirSync(opts.runDir, { recursive: true });
  if (contestants.some((c) => c.kind === 'decide' || c.kind === 'llm')) {
    try {
      const sample = await measureNetwork();
      appendFileSync(networkFile(opts.runDir), JSON.stringify(sample) + '\n');
      log(`AI Gateway answers a request that does no model work in ${Math.round(sample.medianMs)} ms (median of 5)`);
    } catch (error) {
      log(`The network floor could not be measured: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const file = predictionsFile(opts.runDir);
  const done = new Set(
    readPredictions(opts.runDir)
      .filter((p) => p.probability !== null)
      .map((p) => `${p.contestant}\u0000${p.pack}\u0000${p.itemId}`),
  );

  for (const contestant of contestants) {
    const todo = items.filter((item) => !done.has(`${contestant.id}\u0000${item.pack}\u0000${item.id}`));
    if (!todo.length) {
      log(`${contestant.id} has already answered all ${items.length} items`);
      continue;
    }
    // A person answers one item at a time with no time limit and no warm-up.
    // Every other contestant makes one unrecorded call first to open the
    // connection, so the first timed item does not carry the TLS handshake.
    const human = contestant.kind === 'human';
    const timeoutMs = human ? Infinity : opts.timeoutMs;
    if (human) log(`${contestant.id} answers ${todo.length} items. Each clock starts when the item appears.`);
    else await decideOne(contestant, todo[0], timeoutMs);

    let finished = 0;
    let failed = 0;
    await pool(todo, human ? 1 : (opts.concurrency ?? 4), async (item) => {
      const prediction = await decideOne(contestant, item, timeoutMs);
      appendFileSync(file, JSON.stringify(prediction) + '\n');
      finished++;
      if (prediction.probability === null) {
        failed++;
        if (failed <= 3) log(`${contestant.id} ${item.id}: ${prediction.error}`);
      }
      if (finished % 50 === 0 || finished === todo.length) {
        log(`${contestant.id} has answered ${finished} of ${todo.length} items (${failed} failed)`);
      }
    });
    (contestant.model as { close?: () => void }).close?.();
  }
}
