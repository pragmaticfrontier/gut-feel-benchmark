import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readPredictions, runBenchmark } from '../src/bench.ts';
import { buildBaseRates } from '../src/packs/base-rates.ts';
import { writeReport } from '../src/report.ts';

test('a mock run writes predictions, resumes, and ranks the oracle above the coin', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gfb-'));
  const dataDir = join(dir, 'data');
  const runDir = join(dir, 'results', 'test');
  mkdirSync(dataDir);
  writeFileSync(join(dataDir, 'base-rates.jsonl'), buildBaseRates().map((i) => JSON.stringify(i)).join('\n'));

  const opts = {
    contestants: ['mock:oracle', 'mock:coin'],
    packs: ['base-rates'],
    dataDir,
    runDir,
    limit: 12,
    concurrency: 12,
    log: () => {},
  };
  await runBenchmark(opts);
  assert.equal(readPredictions(runDir).length, 24);

  await runBenchmark(opts); // everything answered, so nothing is sent again
  assert.equal(readPredictions(runDir).length, 24);

  const summary = await writeReport(runDir, dataDir, () => {});
  const [first, second] = summary.scores;
  assert.equal(first.contestant, 'mock:oracle');
  assert.equal(second.contestant, 'mock:coin');
  assert.ok(first.skill > 0.5, `oracle skill ${first.skill}`);
  // A constant forecast can never beat the base rate on the same items.
  assert.ok(second.skill <= 0, `coin skill ${second.skill}`);
});
