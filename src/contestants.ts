import type {
  Experimental_DecisionModelV4,
  Experimental_DecisionModelV4CallOptions,
  Experimental_DecisionModelV4Result,
} from '@ai-sdk/provider';
import type { Experimental_DecisionModel } from 'ai';
import { HumanDecisionModel } from './human-decision-model.ts';
import { LanguageDecisionModel, type Reasoning } from './llm-decision-model.ts';
import { hash, normal, rng } from './random.ts';
import type { Item } from './types.ts';

export interface Contestant {
  /** The spec string names the contestant in results. */
  id: string;
  kind: 'decide' | 'llm' | 'human' | 'mock';
  model: Experimental_DecisionModel;
  /** The report looks up prices by this Gateway model id. */
  gatewayId?: string;
}

const REASONING: Reasoning[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/**
 * Contestant specs:
 *   decide:typesafe-ai/jev         a native decision model on AI Gateway (the prefix is optional)
 *   llm:anthropic/claude-opus-5.5  a Gateway language model answering through structured output
 *   llm:openai/gpt-6.1-sol@high    the same, with a reasoning budget (default: none)
 *   human:alex                     a person answering in the terminal, as a human baseline
 *   mock:oracle, mock:coin         offline contestants for tests and dry runs
 */
export function makeContestant(spec: string, items: Item[] = []): Contestant {
  const [kind, rest] = spec.includes(':') ? (spec.split(/:(.*)/s, 2) as [string, string]) : ['decide', spec];

  if (kind === 'decide') return { id: `decide:${rest}`, kind, model: rest, gatewayId: rest };

  if (kind === 'llm') {
    const [modelId, reasoning = 'none'] = rest.split('@');
    if (!REASONING.includes(reasoning as Reasoning)) {
      throw new Error(`Unknown reasoning level "${reasoning}" in ${spec}; use one of ${REASONING.join(', ')}`);
    }
    return {
      id: reasoning === 'none' ? `llm:${modelId}` : `llm:${modelId}@${reasoning}`,
      kind,
      model: new LanguageDecisionModel(modelId, { reasoning: reasoning as Reasoning }),
      gatewayId: modelId,
    };
  }

  if (kind === 'human') {
    if (!rest) throw new Error('Name the person in a human spec, such as human:alex');
    return { id: `human:${rest}`, kind, model: new HumanDecisionModel(rest) };
  }

  if (kind === 'mock') {
    if (rest === 'coin') return { id: spec, kind, model: new MockDecisionModel('coin', () => ({ p: 0.5, ms: 0 })) };
    if (rest === 'oracle') return { id: spec, kind, model: oracle(items) };
    throw new Error(`Unknown mock "${rest}"; use mock:oracle or mock:coin`);
  }

  throw new Error(`Unknown contestant kind "${kind}" in ${spec}; use decide:, llm:, human: or mock:`);
}

/** Identifies an item from the request alone, the way a mock sees it. */
export function requestKey(state: unknown, instructions: unknown): string {
  return JSON.stringify([state, instructions]);
}

/**
 * The oracle knows the truth and blurs it with noise of 0.6 in log-odds and a
 * log-normal latency with a 300 ms median, so some answers miss a 1 s deadline.
 * It exercises the scoring and stands in for no real model.
 */
function oracle(items: Item[]): MockDecisionModel {
  const truths = new Map(items.map((item) => [requestKey(item.state, item.question.instructions), item]));
  return new MockDecisionModel('oracle', (key) => {
    const item = truths.get(key);
    if (!item) return { p: 0.5, ms: 0 };
    const random = rng(hash(item.pack + item.id));
    const t = Math.min(Math.max(item.truth.value, 0.02), 0.98);
    const logit = Math.log(t / (1 - t)) + 0.6 * normal(random);
    return { p: 1 / (1 + Math.exp(-logit)), ms: Math.min(5000, 300 * Math.exp(0.8 * normal(random))) };
  });
}

class MockDecisionModel implements Experimental_DecisionModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'gut-feel-benchmark.mock';
  readonly supportedQuestionTypes = ['boolean'] as const;

  constructor(
    readonly modelId: string,
    private readonly answer: (key: string) => { p: number; ms: number },
  ) {}

  async doDecide(call: Experimental_DecisionModelV4CallOptions): Promise<Experimental_DecisionModelV4Result> {
    const part = call.state[0];
    const state = part?.type === 'text' ? part.text : part?.type === 'json' ? part.value : null;
    const answers: Experimental_DecisionModelV4Result['answers'] = {};
    let wait = 0;
    for (const [id, q] of Object.entries(call.questions)) {
      const { p, ms } = this.answer(requestKey(state, q.instructions));
      answers[id] = { type: 'boolean', probability: p };
      wait = Math.max(wait, ms);
    }
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return { answers, usage: { inputTokens: 0, outputTokens: 0 }, warnings: [] };
  }
}
