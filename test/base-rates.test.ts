import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBaseRates, posterior } from '../src/packs/base-rates.ts';

test('posterior reproduces the classic mammography problem', () => {
  // With 1% prevalence, 90% sensitivity and 9% false positives, about 1 positive in 11 is cancer.
  assert.ok(Math.abs(posterior(0.01, 0.9, 0.09) - 0.0917) < 0.0001);
});

test('every item states the numbers its truth was computed from', () => {
  const items = buildBaseRates();
  assert.equal(items.length, 100);
  for (const item of items) {
    const numbers = [...(item.state as string).matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]) / 100);
    assert.equal(numbers.length, 3, item.id);
    const [prev, sens, fpr] = numbers;
    assert.ok(Math.abs(posterior(prev, sens, fpr) - item.truth.value) < 1e-5, item.id);
  }
});

test('truths spread evenly over ten bins', () => {
  const bins = Array(10).fill(0);
  for (const item of buildBaseRates()) bins[Math.min(9, Math.floor(item.truth.value * 10))]++;
  assert.deepEqual(bins, Array(10).fill(10));
});
