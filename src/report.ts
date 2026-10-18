import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readNetwork, readPredictions, type NetworkSample } from './bench.ts';
import { makeContestant } from './contestants.ts';
import { loadPack, PACKS } from './packs/index.ts';
import { bootstrap, DEADLINES_MS, scoreRun, type ContestantScore, type Interval } from './score.ts';
import type { Item, Prediction } from './types.ts';

interface Price {
  input: number;
  output: number;
}

/** Loads per-token prices from AI Gateway's public model list and caches them beside the run. */
async function loadPrices(runDir: string): Promise<Map<string, Price>> {
  const cache = join(runDir, 'pricing.json');
  let data: { id: string; pricing?: { input?: string; output?: string } }[] | undefined;
  if (existsSync(cache)) data = JSON.parse(readFileSync(cache, 'utf8'));
  else {
    try {
      const res = await fetch('https://ai-gateway.vercel.sh/v1/models');
      if (res.ok) {
        data = ((await res.json()) as { data: typeof data }).data;
        writeFileSync(cache, JSON.stringify(data));
      }
    } catch {
      // Offline, the report leaves cost blank.
    }
  }
  return new Map(
    (data ?? []).map((m) => [m.id, { input: Number(m.pricing?.input ?? NaN), output: Number(m.pricing?.output ?? NaN) }]),
  );
}

function costPer1k(score: ContestantScore, prices: Map<string, Price>): number | null {
  let gatewayId: string | undefined;
  try {
    gatewayId = makeContestant(score.contestant).gatewayId;
  } catch {
    return null;
  }
  const price = gatewayId ? prices.get(gatewayId) : undefined;
  if (!price || !score.answered) return null;
  const cost = score.inputTokens * price.input + (score.outputTokens * price.output || 0);
  return Number.isFinite(cost) ? (cost / score.answered) * 1000 : null;
}

const pct = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(1) : 'n/a');
const range = (i: Interval | undefined) => (i ? `${pct(i.lo)} to ${pct(i.hi)}` : 'n/a');
const share = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
const ms = (x: number | null) => (x === null ? 'n/a' : x < 1000 ? `${Math.round(x)} ms` : `${(x / 1000).toFixed(1)} s`);
const usd = (x: number | null) => (x === null ? 'n/a' : x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(2)}`);
const secs = (d: number) => `${d / 1000} s`;
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function table(header: string[], rows: string[][]): string {
  const align = header.map((_, i) => (i === 0 ? '---' : '---:'));
  return [header, align, ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');
}

export interface Summary {
  run: string;
  generatedAt: string;
  deadlinesMs: number[];
  headlinePacks: string[];
  bootstrapSamples: number;
  network: NetworkSample[];
  scores: (ContestantScore & {
    costPer1k: number | null;
    gutScoreInterval: Interval;
    skillInterval: Interval;
    /** The share of resamples in which this contestant beats the next one down. */
    aheadOfNext: number | null;
  })[];
  /**
   * Contestants that answered only part of the run. Each is ranked against the
   * full contestants on its own items, because counting the items it was never
   * asked as base-rate answers would misstate its skill.
   */
  partial: { contestant: string; items: number; scores: ContestantScore[] }[];
}

const key = (p: Prediction) => `${p.pack}\u0000${p.itemId}`;

/** Splits contestants into those that attempted every item in the run and those that attempted only some. */
function coverage(predictions: Prediction[]): { complete: string[]; partial: Map<string, Set<string>> } {
  const attempted = new Map<string, Set<string>>();
  for (const p of predictions) {
    if (!attempted.has(p.contestant)) attempted.set(p.contestant, new Set());
    attempted.get(p.contestant)!.add(key(p));
  }
  const all = new Set(predictions.map(key));
  const complete = [...attempted].filter(([, items]) => items.size === all.size).map(([c]) => c);
  // With nobody complete there is nothing to rank against, so every contestant is scored together as before.
  if (!complete.length) return { complete: [...attempted.keys()], partial: new Map() };
  return { complete, partial: new Map([...attempted].filter(([c]) => !complete.includes(c))) };
}

export async function writeReport(runDir: string, dataDir: string, log = console.log): Promise<Summary> {
  const all = readPredictions(runDir);
  if (!all.length) throw new Error(`No predictions in ${runDir}. Run \`npm run bench\` first.`);

  const packNames = PACKS.map((p) => p.name).filter((name) => all.some((p) => p.pack === name));
  const packs = new Map<string, Item[]>(packNames.map((name) => [name, loadPack(dataDir, name)]));
  const headline = PACKS.filter((p) => p.headline && packNames.includes(p.name)).map((p) => p.name);
  const outside = packNames.filter((name) => !headline.includes(name));
  const prices = await loadPrices(runDir);
  const { complete, partial } = coverage(all);
  const predictions = all.filter((p) => complete.includes(p.contestant));
  const boot = bootstrap(packs, predictions, { headline, samples: 1000, seed: 1 });
  const ranked = scoreRun(packs, predictions, { headline }).sort((a, b) => b.gutScore - a.gutScore);
  const partialScores = [...partial].map(([contestant, items]) => ({
    contestant,
    items: items.size,
    scores: scoreRun(packs, all.filter((p) => items.has(key(p)) && (p.contestant === contestant || complete.includes(p.contestant))), { headline })
      .sort((a, b) => b.gutScore - a.gutScore),
  }));
  const scores = ranked.map((s, i) => ({
    ...s,
    costPer1k: costPer1k(s, prices),
    gutScoreInterval: boot.intervals.get(s.contestant)!.gutScore,
    skillInterval: boot.intervals.get(s.contestant)!.skill,
    aheadOfNext: i + 1 < ranked.length ? boot.ahead(s.contestant, ranked[i + 1].contestant) : null,
  }));
  const network = readNetwork(runDir);

  const run = basename(runDir);
  const summary: Summary = {
    run,
    generatedAt: new Date().toISOString(),
    deadlinesMs: DEADLINES_MS,
    headlinePacks: headline,
    bootstrapSamples: boot.samples,
    network,
    scores,
    partial: partialScores,
  };
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

  const evaluated = scores[0]?.packs.map((p) => `${p.pack} (${p.n})`).join(', ');
  const headlineText = outside.length
    ? `Gut Score and Skill are Brier skill scores against the base rate, times 100, averaged over the headline packs: ${list(headline)}. ${list(outside)} ${outside.length === 1 ? 'is' : 'are'} scored below but kept out of the headline, because ${outside.length === 1 ? 'its' : 'their'} records are public and a model may have memorised them.`
    : `Gut Score and Skill are Brier skill scores against the base rate, times 100, averaged over ${list(headline)}.`;
  const topPacks = (s: ContestantScore) => s.packs.filter((p) => headline.includes(p.pack));

  const md = [
    `# Gut Feel Benchmark: run ${run}`,
    '',
    `Generated ${summary.generatedAt.slice(0, 16).replace('T', ' ')} UTC over ${evaluated}.`,
    headlineText,
    'Gut Score averages skill over seven deadlines from 0.25 s to 16 s. An answer that misses a deadline counts as the base rate, and no deadline scores above the skill of every answer.',
    `The 95% intervals come from ${boot.samples.toLocaleString('en-US')} paired bootstrap resamples of the items. "Ahead of next" is the share of resamples in which a contestant's Gut Score beats the next one down, and below 95% the two are not separated.`,
    '',
    '## Leaderboard',
    '',
    table(
      ['Contestant', 'Gut Score', '95% interval', 'Ahead of next', 'Skill', '95% interval', 'p50 latency', 'p95 latency', 'Answered', 'Cost per 1,000'],
      scores.map((s) => [
        `\`${s.contestant}\``,
        pct(s.gutScore),
        range(s.gutScoreInterval),
        share(s.aheadOfNext),
        pct(s.skill),
        range(s.skillInterval),
        ms(s.latencyP50),
        ms(s.latencyP95),
        `${s.answered}/${s.n}`,
        usd(s.costPer1k),
      ]),
    ),
    '',
    '## Skill by deadline',
    '',
    `Each column averages the headline packs with every answer slower than the deadline counted as the base rate.`,
    '',
    table(
      ['Contestant', ...DEADLINES_MS.map(secs), 'No deadline'],
      scores.map((s) => [
        `\`${s.contestant}\``,
        ...DEADLINES_MS.map((d) => pct(avg(topPacks(s).map((p) => p.skillAt[d])))),
        pct(s.skill),
      ]),
    ),
    '',
    '## Skill by pack',
    '',
    table(
      ['Contestant', ...packNames.map((name) => (headline.includes(name) ? name : `${name} (outside headline)`))],
      scores.map((s) => [`\`${s.contestant}\``, ...packNames.map((name) => pct(s.packs.find((p) => p.pack === name)?.skill ?? NaN))]),
    ),
    '',
    ...packNames.flatMap((name) => {
      const info = PACKS.find((p) => p.name === name)!;
      const first = scores[0].packs.find((p) => p.pack === name)!;
      return [
        `## ${name}`,
        '',
        `Each item asks about ${info.domain}. The truth is ${info.truth === 'probability' ? 'an exact probability' : 'the observed outcome'}, and the base rate is ${first.baseRate.toFixed(3)} over ${first.n} items.${headline.includes(name) ? '' : ' This pack is outside the headline score.'}`,
        '',
        table(
          ['Contestant', 'Skill', 'Gut Score', 'Log loss', 'ECE', 'Accuracy', 'p50 latency', 'Answered'],
          scores.map((s) => {
            const p = s.packs.find((x) => x.pack === name)!;
            return [
              `\`${s.contestant}\``,
              pct(p.skill),
              pct(p.gutScore),
              p.logLoss.toFixed(3),
              p.ece.toFixed(3),
              pct(p.accuracy),
              ms(p.latencyP50),
              `${p.answered}/${p.n}`,
            ];
          }),
        ),
        '',
      ];
    }),
    ...partialSection(partialScores),
    ...runNotes(scores, network),
  ].join('\n');
  writeFileSync(join(runDir, 'report.md'), md);

  log(
    table(
      ['Contestant', 'Gut Score', '95% interval', 'Skill', 'p50', 'Answered'],
      scores.map((s) => [s.contestant, pct(s.gutScore), range(s.gutScoreInterval), pct(s.skill), ms(s.latencyP50), `${s.answered}/${s.n}`]),
    ),
  );
  log(`\nThe report is in ${join(runDir, 'report.md')}, with summary.json beside it.`);
  return summary;
}

/** Ranks each partial contestant against the full field on the items it answered, so its skill is not diluted. */
function partialSection(partial: Summary['partial']): string[] {
  return partial.flatMap(({ contestant, items, scores }) => [
    `## Partial run: \`${contestant}\``,
    '',
    `\`${contestant}\` was asked ${items} of the run's items and is left out of the tables above. Here every contestant is scored on those ${items} items only.`,
    '',
    table(
      ['Contestant', 'Gut Score', 'Skill', 'p50 latency', 'Answered'],
      scores.map((s) => [`\`${s.contestant}\``, pct(s.gutScore), pct(s.skill), ms(s.latencyP50), `${s.answered}/${s.n}`]),
    ),
    '',
  ]);
}

/** Says what the latencies include and whether each chat model reasoned as asked. */
function runNotes(scores: ContestantScore[], network: NetworkSample[]): string[] {
  const lines = ['## Run notes', ''];
  if (network.length) {
    const medians = network.map((n) => n.medianMs).sort((a, b) => a - b);
    const median = medians[Math.floor(medians.length / 2)];
    lines.push(
      `AI Gateway took a median of ${Math.round(median)} ms to answer a request that does no model work, measured ${network.length === 1 ? 'once' : `${network.length} times`} at the start of a session. Every latency above includes about that much network and Gateway time.`,
      '',
    );
  } else {
    lines.push('No network floor was measured for this run, so the latencies above mix network and model time.', '');
  }

  const chat = scores.filter((s) => s.contestant.startsWith('llm:') || Object.keys(s.warnings).length);
  if (chat.length) {
    lines.push(
      table(
        ['Contestant', 'Reasoning asked', 'Reasoning tokens per answer', 'Warnings'],
        chat.map((s) => [
          `\`${s.contestant}\``,
          s.contestant.includes('@') ? s.contestant.split('@')[1] : 'none',
          s.answered ? (s.reasoningTokens / s.answered).toFixed(1) : 'n/a',
          Object.entries(s.warnings).map(([w, n]) => `${w} (${n} answers)`).join('; ') || 'none',
        ]),
      ),
      '',
    );
    for (const s of chat) {
      if (!s.contestant.includes('@') && s.reasoningTokens > 0) {
        lines.push(
          `\`${s.contestant}\` was asked to answer with reasoning off but used ${(s.reasoningTokens / Math.max(1, s.answered)).toFixed(0)} reasoning tokens per answer, so its latency and cost include reasoning.`,
          '',
        );
      }
    }
  }
  return lines;
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
