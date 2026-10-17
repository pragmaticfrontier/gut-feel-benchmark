import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildBaseRates } from '../src/packs/base-rates.ts';
import { writeReport } from '../src/report.ts';
import type { Prediction } from '../src/types.ts';

test('a contestant asked only part of the run is ranked on its own items, not diluted by the rest', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gfb-report-'));
  const dataDir = join(dir, 'data');
  const runDir = join(dir, 'results', 'partial');
  mkdirSync(dataDir);
  mkdirSync(runDir, { recursive: true });
  const items = buildBaseRates().slice(0, 12);
  writeFileSync(join(dataDir, 'base-rates.jsonl'), items.map((i) => JSON.stringify(i)).join('\n'));

  // Both contestants answer with the exact truth; "short" was asked only the first four items.
  const answer = (contestant: string, i: (typeof items)[number]): Prediction => ({
    contestant, pack: i.pack, itemId: i.id, probability: i.truth.value, latencyMs: 100, at: '',
  });
  const predictions = [...items.map((i) => answer('full', i)), ...items.slice(0, 4).map((i) => answer('short', i))];
  writeFileSync(join(runDir, 'predictions.jsonl'), predictions.map((p) => JSON.stringify(p)).join('\n'));

  const summary = await writeReport(runDir, dataDir, () => {});
  assert.deepEqual(summary.scores.map((s) => s.contestant), ['full']);
  assert.equal(summary.partial.length, 1);
  const { contestant, items: asked, scores } = summary.partial[0];
  assert.equal(contestant, 'short');
  assert.equal(asked, 4);
  // On its own four items the short contestant is perfect, as it would be anywhere.
  assert.equal(scores.find((s) => s.contestant === 'short')!.skill, 1);
});
