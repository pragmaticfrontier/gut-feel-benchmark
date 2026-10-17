import type {
  Experimental_DecisionModelV4,
  Experimental_DecisionModelV4CallOptions,
  Experimental_DecisionModelV4Result,
} from '@ai-sdk/provider';
import { generateText, Output, type LanguageModel } from 'ai';
import { z } from 'zod';

export type Reasoning = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** The adapter reports reasoning tokens under this provider-metadata key. */
export const METADATA_KEY = 'gut-feel-benchmark';

const SYSTEM =
  'You are an experienced expert making a fast judgment call. Read the situation, then give the probability ' +
  'that each statement is true. Answer with probabilities only: 0 means certainly false, 1 means certainly true.';

/**
 * Wraps a chat model as a Jev-style decision model, so a frontier LLM answers
 * the same request Jev does: shared state in, P(true) per boolean question out.
 *
 * The AI SDK ships decision adapters for Anthropic and Google, but they call
 * each provider directly. This one routes any Gateway language model through
 * structured output, so every contestant runs on one key and one network path.
 */
export class LanguageDecisionModel implements Experimental_DecisionModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'gut-feel-benchmark.llm';
  readonly supportedQuestionTypes = ['boolean'] as const;

  constructor(
    readonly modelId: string,
    private readonly options: { model?: LanguageModel; reasoning?: Reasoning } = {},
  ) {}

  async doDecide(call: Experimental_DecisionModelV4CallOptions): Promise<Experimental_DecisionModelV4Result> {
    const ids = Object.keys(call.questions);
    // The schema leaves out min and max because some providers reject numeric
    // bounds in structured output; experimental_decide rejects a probability outside [0, 1].
    const schema = z.object(Object.fromEntries(ids.map((id) => [id, z.number().describe('Give the probability, from 0 to 1, that this statement is true.')])));

    const result = await generateText({
      model: this.options.model ?? this.modelId,
      system: SYSTEM,
      prompt: renderPrompt(call),
      output: Output.object({ schema }),
      reasoning: this.options.reasoning ?? 'none',
      abortSignal: call.abortSignal,
      headers: call.headers,
      maxRetries: 0,
    });

    const output = result.output as Record<string, number>;
    return {
      answers: Object.fromEntries(ids.map((id) => [id, { type: 'boolean' as const, probability: output[id] }])),
      usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
      // A provider that ignores the reasoning setting says so here, and the
      // reasoning token count shows whether it reasoned anyway.
      warnings: result.warnings as Experimental_DecisionModelV4Result['warnings'],
      providerMetadata: {
        [METADATA_KEY]: { reasoningTokens: result.usage.outputTokenDetails?.reasoningTokens ?? null },
      },
      response: { modelId: result.response.modelId, timestamp: result.response.timestamp },
    };
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function renderPrompt(call: Experimental_DecisionModelV4CallOptions): string {
  const state = call.state
    .map((part) => {
      if (part.type === 'text') return part.text;
      if (part.type === 'json') return JSON.stringify(part.value, null, 2);
      throw new Error('LanguageDecisionModel accepts text and JSON state only');
    })
    .join('\n\n');

  const statements = Object.entries(call.questions).map(([id, q]) => {
    if (q.type !== 'boolean') throw new Error(`LanguageDecisionModel answers boolean questions only, got ${q.type}`);
    const lines = [`- ${id}: ${text(q.instructions)}`];
    if (q.criteria?.true) lines.push(`  True means: ${text(q.criteria.true)}`);
    if (q.criteria?.false) lines.push(`  False means: ${text(q.criteria.false)}`);
    return lines.join('\n');
  });

  return `Situation:\n${state}\n\nStatements:\n${statements.join('\n')}\n\nFor each statement id, give the probability that it is true.`;
}
