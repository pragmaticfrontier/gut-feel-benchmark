import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { experimental_decide } from 'ai';
import { HumanDecisionModel } from '../src/human-decision-model.ts';

test('a person answers in percent and a bad entry is asked again', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let shown = '';
  output.on('data', (chunk) => (shown += chunk));
  const model = new HumanDecisionModel('tester', { input, output });

  // Lines typed before the prompt appears are kept for it.
  input.write('maybe\n');
  input.write('41%\n');
  const result = await experimental_decide({
    model,
    state: 'Player A: 4♣ 10♣\nPlayer B: 3♥ A♥',
    questions: { answer: { type: 'boolean', instructions: 'Player A wins the pot at showdown.' } },
  });
  model.close();

  assert.equal(result.answers.answer.probability, 0.41);
  assert.match(shown, /Player A: 4♣ 10♣/);
  assert.match(shown, /Type a number from 0 to 100/);
});
