import type {
  Experimental_DecisionModelV4,
  Experimental_DecisionModelV4CallOptions,
  Experimental_DecisionModelV4Result,
} from '@ai-sdk/provider';
import { createInterface, type Interface } from 'node:readline';
import { renderPrompt } from './llm-decision-model.ts';

/**
 * Lets a person answer the same Jev requests in the terminal, so a human
 * expert lands in the same predictions file and report as the models. The
 * clock runs from the moment the item is printed until the answer is entered.
 */
export class HumanDecisionModel implements Experimental_DecisionModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'gut-feel-benchmark.human';
  readonly supportedQuestionTypes = ['boolean'] as const;

  private reader?: Interface;
  private lines?: AsyncIterator<string>;
  private shown = 0;

  constructor(
    readonly modelId: string,
    private readonly io: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream } = {},
  ) {}

  async doDecide(call: Experimental_DecisionModelV4CallOptions): Promise<Experimental_DecisionModelV4Result> {
    const out = this.io.output ?? process.stdout;
    out.write(`\n${'─'.repeat(64)}\nItem ${++this.shown}\n\n${renderPrompt(call)}\n`);

    const ids = Object.keys(call.questions);
    const answers: Experimental_DecisionModelV4Result['answers'] = {};
    for (const id of ids) {
      const ask = ids.length === 1 ? 'Your probability, from 0 to 100: ' : `Your probability for ${id}, from 0 to 100: `;
      for (;;) {
        out.write(ask);
        const text = (await this.readLine()).trim().replace(/%$/, '');
        const value = Number(text);
        if (text !== '' && Number.isFinite(value) && value >= 0 && value <= 100) {
          answers[id] = { type: 'boolean', probability: value / 100 };
          break;
        }
        out.write('Type a number from 0 to 100, such as 35.\n');
      }
    }
    return { answers, usage: { inputTokens: 0, outputTokens: 0 }, warnings: [] };
  }

  /** Closes the terminal reader so the process can exit after the last item. */
  close(): void {
    this.reader?.close();
  }

  // An async iterator buffers lines, so an answer typed quickly is never lost between items.
  private async readLine(): Promise<string> {
    this.reader ??= createInterface({ input: this.io.input ?? process.stdin, terminal: false });
    this.lines ??= this.reader[Symbol.asyncIterator]();
    const next = await this.lines.next();
    if (next.done) throw new Error('The input ended before an answer was given.');
    return next.value;
  }
}
