import assert from 'node:assert/strict';
import { test } from 'node:test';
import { experimental_decide } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { decideOne } from '../src/bench.ts';
import { LanguageDecisionModel } from '../src/llm-decision-model.ts';

test('a chat model answers a Jev request with P(true)', async () => {
  const llm = new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: '{"answer":0.73}' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 120, noCache: 120, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 6, text: 6, reasoning: 0 },
      },
      warnings: [],
    },
  });

  const result = await experimental_decide({
    model: new LanguageDecisionModel('mock/llm', { model: llm }),
    state: { title: 'Show HN: A tiny database', site: 'github.com' },
    questions: { answer: { type: 'boolean', instructions: 'This story reached 100 points.' } },
  });

  assert.equal(result.answers.answer.probability, 0.73);
  assert.equal(result.usage.inputTokens, 120);

  const call = llm.doGenerateCalls[0];
  const prompt = JSON.stringify(call.prompt);
  assert.match(prompt, /Show HN: A tiny database/);
  assert.match(prompt, /answer: This story reached 100 points/);
  assert.equal(call.reasoning, 'none');
});

test('an out-of-range probability is rejected, not clipped', async () => {
  const llm = new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: '{"answer":1.4}' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    },
  });
  await assert.rejects(
    experimental_decide({
      model: new LanguageDecisionModel('mock/llm', { model: llm }),
      state: 'x',
      questions: { answer: { type: 'boolean', instructions: 'y' } },
    }),
  );
});

test('the runner records reasoning tokens and SDK warnings for a chat model', async () => {
  const llm = new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: '{"answer":0.6}' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 90, noCache: 90, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 50, text: 6, reasoning: 44 },
      },
      warnings: [{ type: 'unsupported', feature: 'reasoning', details: 'this model always reasons' }],
    },
  });
  const prediction = await decideOne(
    { id: 'llm:mock/llm', kind: 'llm', model: new LanguageDecisionModel('mock/llm', { model: llm }) },
    { id: 'x', pack: 'demo', state: 'x', question: { instructions: 'y' }, truth: { kind: 'outcome', value: 1 } },
  );
  assert.equal(prediction.probability, 0.6);
  assert.equal(prediction.reasoningTokens, 44);
  assert.ok(prediction.warnings?.some((w) => w.includes('reasoning')), JSON.stringify(prediction.warnings));
});
