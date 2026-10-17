import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Item } from '../types.ts';

export interface PackInfo {
  name: string;
  domain: string;
  truth: 'probability' | 'outcome';
  source: string;
  /**
   * A headline pack counts toward the leaderboard's Gut Score and Skill.
   * A pack a model may have memorised is scored and reported but kept out.
   */
  headline: boolean;
}

export const PACKS: PackInfo[] = [
  {
    name: 'poker-equity',
    domain: "heads-up hold'em equity with both players all in before the flop",
    truth: 'probability',
    source: 'generated, with exact equity over all 1,712,304 boards',
    headline: true,
  },
  {
    name: 'base-rates',
    domain: 'the chance of a condition after a positive screening test',
    truth: 'probability',
    source: "generated, with the exact posterior by Bayes' rule",
    headline: true,
  },
  {
    name: 'heart-disease',
    domain: 'coronary artery disease after a cardiology work-up',
    truth: 'outcome',
    source: 'the UCI Heart Disease data from the Cleveland Clinic, CC BY 4.0',
    // The records have been public since 1988, so a score here can reflect recall.
    headline: false,
  },
  {
    name: 'hn-frontpage',
    domain: 'whether a Hacker News story reaches 100 points',
    truth: 'outcome',
    source: 'the Hacker News API, with stories 7 to 14 days old at build time',
    headline: true,
  },
];

export function packFile(dataDir: string, name: string): string {
  return join(dataDir, `${name}.jsonl`);
}

export function loadPack(dataDir: string, name: string): Item[] {
  const file = packFile(dataDir, name);
  if (!existsSync(file)) throw new Error(`Pack "${name}" not found at ${file}. Run \`npm run build:data\` first.`);
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Item);
}
