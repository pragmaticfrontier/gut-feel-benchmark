import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_ROSTER, runBenchmark } from './bench.ts';
import { buildBaseRates } from './packs/base-rates.ts';
import { buildHeart } from './packs/heart.ts';
import { buildHn } from './packs/hn.ts';
import { packFile, PACKS } from './packs/index.ts';
import { buildPoker } from './packs/poker.ts';
import { writeReport } from './report.ts';
import type { Item } from './types.ts';

const USAGE = `Usage:
  npm run build:data [-- --packs a,b] [--as-of YYYY-MM-DD]
  npm run bench [-- --models a,b] [--packs a,b] [--limit n] [--concurrency n] [--timeout ms] [--run name]
  npm run report [-- --run name]

Packs: ${PACKS.map((p) => p.name).join(', ')}
Default models: ${DEFAULT_ROSTER.join(', ')}
A person joins a run as a contestant with --models human:<name>.`;

try {
  process.loadEnvFile();
} catch {
  // No .env file; the environment alone is used.
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    models: { type: 'string' },
    packs: { type: 'string' },
    limit: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
    timeout: { type: 'string', default: '120000' },
    run: { type: 'string', default: new Date().toISOString().slice(0, 10) },
    data: { type: 'string', default: 'data' },
    results: { type: 'string', default: 'results' },
    'as-of': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

const list = (value: string | undefined, fallback: string[]) =>
  value ? value.split(',').map((s) => s.trim()).filter(Boolean) : fallback;
const packs = list(values.packs, PACKS.map((p) => p.name));
for (const name of packs) {
  if (!PACKS.some((p) => p.name === name)) throw new Error(`Unknown pack "${name}". ${USAGE}`);
}
const runDir = join(values.results, values.run);

function save(name: string, items: Item[]): void {
  mkdirSync(values.data, { recursive: true });
  writeFileSync(packFile(values.data, name), items.map((item) => JSON.stringify(item)).join('\n') + '\n');
  console.log(`${name}: wrote ${items.length} items to ${packFile(values.data, name)}`);
}

const command = positionals[0];
if (values.help || !command) {
  console.log(USAGE);
} else if (command === 'build-data') {
  for (const name of packs) {
    if (name === 'poker-equity') {
      console.log('poker-equity: the build enumerates every board for 100 matchups, which takes about a minute');
      save(name, buildPoker());
    } else if (name === 'base-rates') save(name, buildBaseRates());
    else if (name === 'heart-disease') save(name, await buildHeart());
    else if (name === 'hn-frontpage') {
      const asOf = values['as-of'] ? new Date(`${values['as-of']}T00:00:00Z`) : new Date();
      save(name, await buildHn({ asOf }));
    }
  }
} else if (command === 'run') {
  await runBenchmark({
    contestants: list(values.models, DEFAULT_ROSTER),
    packs,
    dataDir: values.data,
    runDir,
    limit: values.limit ? Number(values.limit) : undefined,
    concurrency: Number(values.concurrency),
    timeoutMs: Number(values.timeout),
  });
  await writeReport(runDir, values.data);
} else if (command === 'report') {
  await writeReport(runDir, values.data);
} else {
  console.error(`Unknown command "${command}".\n${USAGE}`);
  process.exitCode = 1;
}
