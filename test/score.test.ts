import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accuracy, bootstrap, ece, scorePack, scoreRun, skillScore } from '../src/score.ts';
import type { Item, Prediction } from '../src/types.ts';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('skill is 1 for the truth and 0 for the base rate', () => {
  const truths = [0, 1, 1, 0, 1];
  close(skillScore(truths, truths, 0.6), 1);
  close(skillScore(truths.map(() => 0.6), truths, 0.6), 0);
  // Exact probabilities work the same way.
  const p = [0.1, 0.3, 0.8];
  close(skillScore(p, p, 0.4), 1);
});

test('skill goes negative for a confident wrong forecaster', () => {
  assert.ok(skillScore([1, 0], [0, 1], 0.5) < 0);
});

test('an answer slower than the deadline counts as the base rate', () => {
  const rows = [
    { q: 1, t: 1, ms: 200 },
    { q: 0, t: 0, ms: 3000 },
  ];
  const s = scorePack('demo', rows);
  close(s.skill, 1);
  close(s.skillAt[250], 0.5); // the second answer misses, so half the error remains
  close(s.skillAt[4000], 1);
  close(s.gutScore, (0.5 * 4 + 1 * 3) / 7);
});

test('a failed call scores as the base rate', () => {
  const s = scorePack('demo', [
    { q: null, t: 1, ms: Infinity },
    { q: 0, t: 0, ms: 100 },
  ]);
  assert.equal(s.answered, 1);
  close(s.skill, 0.5);
});

test('calibration error and accuracy', () => {
  close(ece([0.9, 0.9, 0.1, 0.1], [1, 1, 0, 0]), 0.1);
  close(accuracy([0.9, 0.5, 0.2], [1, 1, 0]), 2.5 / 3);
});

test('scoreRun fills a contestant gap with the base rate and keeps the last retry', () => {
  const items: Item[] = [0, 1].map((v, i) => ({
    id: `x${i}`,
    pack: 'demo',
    state: `s${i}`,
    question: { instructions: 'q' },
    truth: { kind: 'outcome', value: v as 0 | 1 },
  }));
  const pred = (contestant: string, itemId: string, probability: number | null): Prediction => ({
    contestant,
    pack: 'demo',
    itemId,
    probability,
    latencyMs: 100,
    at: '',
  });
  const scores = scoreRun(new Map([['demo', items]]), [
    pred('a', 'x0', 0),
    pred('a', 'x1', null),
    pred('a', 'x1', 1), // retried and answered
    pred('b', 'x0', 0), // never attempted x1
  ]);
  const a = scores.find((s) => s.contestant === 'a')!;
  const b = scores.find((s) => s.contestant === 'b')!;
  close(a.skill, 1);
  assert.equal(b.answered, 1);
  assert.equal(b.n, 2);
  close(b.skill, 0.5);
});

test('a late answer cannot lift a forecaster that is worse than the base rate', () => {
  const rows = [
    { q: 1, t: 0, ms: 5000 },
    { q: 0, t: 1, ms: 5000 },
    { q: 0.5, t: 1, ms: 100 },
    { q: 0.5, t: 0, ms: 100 },
  ];
  const s = scorePack('demo', rows);
  assert.ok(s.skill < 0, `skill ${s.skill}`);
  // Without the cap the two slow answers would turn into the base rate and pull the score up to 0.
  for (const d of [250, 1000, 4000]) close(s.skillAt[d], s.skill);
  close(s.gutScore, s.skill);
});

const demoItems = (pack: string, values: number[]): Item[] =>
  values.map((v, i) => ({ id: `${pack}${i}`, pack, state: `${pack}${i}`, question: { instructions: 'q' }, truth: { kind: 'outcome', value: v as 0 | 1 } }));
const answer = (contestant: string, item: Item, probability: number): Prediction => ({
  contestant,
  pack: item.pack,
  itemId: item.id,
  probability,
  latencyMs: 100,
  at: '',
});

test('the headline scores leave out packs outside the headline', () => {
  const kept = demoItems('kept', [0, 1, 0, 1]);
  const left = demoItems('left', [0, 1, 0, 1]);
  const predictions = [...kept.map((i) => answer('a', i, i.truth.value)), ...left.map((i) => answer('a', i, 1 - i.truth.value))];
  const packs = new Map([['kept', kept], ['left', left]]);
  const [all] = scoreRun(packs, predictions);
  const [top] = scoreRun(packs, predictions, { headline: ['kept'] });
  assert.ok(all.skill < 1);
  close(top.skill, 1);
  assert.equal(top.packs.length, 2); // the left-out pack is still scored and reported
});

test('bootstrap intervals bracket the score and separate a sharp forecaster from a coin', () => {
  const values = Array.from({ length: 60 }, (_, i) => (i % 3 === 0 ? 1 : 0));
  const items = demoItems('demo', values);
  const predictions = [
    ...items.map((i) => answer('sharp', i, i.truth.value ? 0.8 : 0.15)),
    ...items.map((i) => answer('coin', i, 0.5)),
  ];
  const packs = new Map([['demo', items]]);
  const scores = scoreRun(packs, predictions);
  const boot = bootstrap(packs, predictions, { samples: 300, seed: 3 });
  for (const s of scores) {
    const { gutScore } = boot.intervals.get(s.contestant)!;
    assert.ok(gutScore.lo <= s.gutScore && s.gutScore <= gutScore.hi, `${s.contestant} ${s.gutScore} outside ${gutScore.lo}..${gutScore.hi}`);
  }
  assert.equal(boot.ahead('sharp', 'coin'), 1);
  // The same seed gives the same intervals, so a report is reproducible.
  assert.deepEqual(bootstrap(packs, predictions, { samples: 300, seed: 3 }).intervals, boot.intervals);
});

test('a forecaster that always answers the base rate scores exactly 0 in every resample', () => {
  const values: number[] = Array.from({ length: 40 }, (_, i) => (i % 4 === 0 ? 1 : 0));
  const items = demoItems('demo', values);
  const base = values.reduce((a, b) => a + b, 0) / values.length;
  const predictions = items.map((i) => answer('flat', i, base));
  const { gutScore, skill } = bootstrap(new Map([['demo', items]]), predictions, { samples: 200 }).intervals.get('flat')!;
  // Each resample is scored against the pack's base rate, not the resample's own mean.
  for (const x of [gutScore.lo, gutScore.hi, skill.lo, skill.hi]) close(x, 0);
});
