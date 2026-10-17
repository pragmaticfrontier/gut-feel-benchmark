export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * The truth is what happened, or the exact probability that it would happen.
 * Outcome packs record a realised 0 or 1. Probability packs record a value
 * computed exactly from the setup, so a forecast can be scored against the
 * truth itself instead of one noisy draw from it.
 */
export type Truth =
  | { kind: 'outcome'; value: 0 | 1 }
  | { kind: 'probability'; value: number };

/** Each gut-feel decision is a Jev request with a state and one boolean question. */
export interface Item {
  id: string;
  pack: string;
  state: string | { [key: string]: Json };
  question: {
    instructions: string;
    criteria?: { true?: string; false?: string };
  };
  truth: Truth;
  meta?: { [key: string]: Json };
}

/** A prediction holds one contestant's answer to one item; a failed call leaves probability null. */
export interface Prediction {
  contestant: string;
  pack: string;
  itemId: string;
  probability: number | null;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Chat models report reasoning tokens, which show whether "reasoning off" held. */
  reasoningTokens?: number;
  /** Warnings from the SDK, such as a provider ignoring the reasoning setting. */
  warnings?: string[];
  error?: string;
  at: string;
}
