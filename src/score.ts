import { rng } from './random.ts';
import type { Item, Prediction } from './types.ts';

/** The Gut Score's deadlines run from a quarter second to 16 seconds, doubling at each step. */
export const DEADLINES_MS = [250, 500, 1000, 2000, 4000, 8000, 16000];

export interface PackScore {
  pack: string;
  n: number;
  answered: number;
  baseRate: number;
  /** Skill is the Brier skill score against the base rate: 1 is perfect and 0 matches the base rate. */
  skill: number;
  /**
   * Skill at each deadline counts slower answers as the base rate, capped at
   * the skill of every answer, so a late answer can lower a score but never raise it.
   */
  skillAt: Record<number, number>;
  /** The Gut Score averages skillAt over DEADLINES_MS. */
  gutScore: number;
  logLoss: number;
  ece: number;
  accuracy: number;
  latencyP50: number | null;
  latencyP95: number | null;
  inputTokens: number;
  outputTokens: number;
}

export interface ContestantScore {
  contestant: string;
  packs: PackScore[];
  /** Skill and Gut Score average the headline packs only. */
  skill: number;
  gutScore: number;
  latencyP50: number | null;
  latencyP95: number | null;
  n: number;
  answered: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  /** Counts each distinct SDK warning by how many answers carried it. */
  warnings: Record<string, number>;
}

export interface ScoreOptions {
  /** These packs make up the headline scores; the default is every pack. */
  headline?: string[];
}

interface Row {
  /** The forecast is null when the call failed or never ran. */
  q: number | null;
  /** The truth is a 0/1 outcome or an exact probability. */
  t: number;
  ms: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Brier skill score against the base rate. The truth can be an outcome or an
 * exact probability; with an outcome this is the textbook Brier skill score,
 * and with a probability it is the share of squared error that the forecast
 * removes relative to always answering the base rate.
 */
export function skillScore(forecasts: number[], truths: number[], base: number): number {
  const err = mean(forecasts.map((q, i) => (q - truths[i]) ** 2));
  const ref = mean(truths.map((t) => (base - t) ** 2));
  return ref === 0 ? 0 : 1 - err / ref;
}

/** Returns cross-entropy in nats, with forecasts clipped to [0.001, 0.999]. */
export function logLoss(forecasts: number[], truths: number[]): number {
  return mean(
    forecasts.map((q, i) => {
      const c = Math.min(0.999, Math.max(0.001, q));
      const t = truths[i];
      return -(t * Math.log(c) + (1 - t) * Math.log(1 - c));
    }),
  );
}

/** Returns the expected calibration error over ten equal-width bins. */
export function ece(forecasts: number[], truths: number[], bins = 10): number {
  const sums = Array.from({ length: bins }, () => ({ n: 0, q: 0, t: 0 }));
  forecasts.forEach((q, i) => {
    const b = sums[Math.min(bins - 1, Math.floor(q * bins))];
    b.n++;
    b.q += q;
    b.t += truths[i];
  });
  return sums.reduce((acc, b) => (b.n ? acc + (b.n / forecasts.length) * Math.abs(b.q / b.n - b.t / b.n) : acc), 0);
}

/** Returns the share of items where the forecast lands on the same side of 0.5 as the truth. */
export function accuracy(forecasts: number[], truths: number[]): number {
  let hits = 0;
  let n = 0;
  forecasts.forEach((q, i) => {
    const t = truths[i];
    if (t === 0.5) return;
    n++;
    if (q === 0.5) hits += 0.5;
    else if (q > 0.5 === t > 0.5) hits++;
  });
  return n ? hits / n : NaN;
}

/**
 * Returns skill with no deadline and at each deadline. A missing answer falls
 * back to the base rate, so it adds error but no skill. At a deadline, late
 * answers fall back to the base rate too, and the result is capped at the
 * no-deadline skill: otherwise a forecaster worse than the base rate would
 * move toward 0 by answering slowly.
 */
function skills(rows: Row[], fixedBase?: number): { base: number; skill: number; skillAt: Record<number, number>; gutScore: number } {
  const truths = rows.map((r) => r.t);
  const base = fixedBase ?? mean(truths);
  const forecast = (r: Row, deadline = Infinity) => (r.q !== null && r.ms <= deadline ? r.q : base);
  const skill = skillScore(rows.map((r) => forecast(r)), truths, base);
  const skillAt: Record<number, number> = {};
  for (const d of DEADLINES_MS) skillAt[d] = Math.min(skill, skillScore(rows.map((r) => forecast(r, d)), truths, base));
  return { base, skill, skillAt, gutScore: mean(DEADLINES_MS.map((d) => skillAt[d])) };
}

export function scorePack(pack: string, rows: Row[]): PackScore {
  const truths = rows.map((r) => r.t);
  const { base, skill, skillAt, gutScore } = skills(rows);
  const answered = rows.filter((r) => r.q !== null);
  const all = rows.map((r) => (r.q !== null ? r.q : base));
  const ms = answered.map((r) => r.ms);
  return {
    pack,
    n: rows.length,
    answered: answered.length,
    baseRate: base,
    skill,
    skillAt,
    gutScore,
    logLoss: logLoss(all, truths),
    ece: ece(all, truths),
    accuracy: accuracy(all, truths),
    latencyP50: quantile(ms, 0.5),
    latencyP95: quantile(ms, 0.95),
    inputTokens: 0,
    outputTokens: 0,
  };
}

/** Pairs each contestant with one row per evaluated item in every pack. */
function collect(packs: Map<string, Item[]>, predictions: Prediction[]) {
  const latest = new Map<string, Prediction>();
  for (const p of predictions) latest.set(`${p.contestant}\u0000${p.pack}\u0000${p.itemId}`, p);
  const contestants = [...new Set(predictions.map((p) => p.contestant))];
  const attempted = new Set([...latest.values()].map((p) => `${p.pack}\u0000${p.itemId}`));
  const evaluated = new Map<string, Item[]>();
  for (const [pack, items] of packs) {
    const kept = items.filter((item) => attempted.has(`${pack}\u0000${item.id}`));
    if (kept.length) evaluated.set(pack, kept);
  }
  const lookup = (contestant: string, pack: string, item: Item) => latest.get(`${contestant}\u0000${pack}\u0000${item.id}`);
  const rowsFor = (contestant: string, pack: string): Row[] =>
    evaluated.get(pack)!.map((item) => {
      const p = lookup(contestant, pack, item);
      return { q: p?.probability ?? null, t: item.truth.value, ms: p?.probability != null ? p.latencyMs : Infinity };
    });
  return { contestants, evaluated, lookup, rowsFor };
}

function headlineOf(packNames: string[], opts: ScoreOptions): Set<string> {
  const chosen = packNames.filter((name) => !opts.headline || opts.headline.includes(name));
  return new Set(chosen.length ? chosen : packNames);
}

/**
 * Scores every contestant on the same items: those any contestant attempted.
 * An item one contestant skipped or failed counts as a base-rate answer for it.
 * When a prediction appears twice (a retried failure), the last line wins.
 */
export function scoreRun(packs: Map<string, Item[]>, predictions: Prediction[], opts: ScoreOptions = {}): ContestantScore[] {
  const { contestants, evaluated, lookup, rowsFor } = collect(packs, predictions);
  const headline = headlineOf([...evaluated.keys()], opts);

  return contestants.map((contestant) => {
    const packScores: PackScore[] = [];
    const latencies: number[] = [];
    let reasoningTokens = 0;
    const warnings: Record<string, number> = {};
    for (const [pack, items] of evaluated) {
      let inputTokens = 0;
      let outputTokens = 0;
      for (const item of items) {
        const p = lookup(contestant, pack, item);
        if (p?.probability != null) latencies.push(p.latencyMs);
        inputTokens += p?.inputTokens ?? 0;
        outputTokens += p?.outputTokens ?? 0;
        reasoningTokens += p?.reasoningTokens ?? 0;
        for (const w of p?.warnings ?? []) warnings[w] = (warnings[w] ?? 0) + 1;
      }
      packScores.push({ ...scorePack(pack, rowsFor(contestant, pack)), inputTokens, outputTokens });
    }
    const top = packScores.filter((s) => headline.has(s.pack));
    return {
      contestant,
      packs: packScores,
      skill: mean(top.map((s) => s.skill)),
      gutScore: mean(top.map((s) => s.gutScore)),
      latencyP50: quantile(latencies, 0.5),
      latencyP95: quantile(latencies, 0.95),
      n: packScores.reduce((a, s) => a + s.n, 0),
      answered: packScores.reduce((a, s) => a + s.answered, 0),
      inputTokens: packScores.reduce((a, s) => a + s.inputTokens, 0),
      outputTokens: packScores.reduce((a, s) => a + s.outputTokens, 0),
      reasoningTokens,
      warnings,
    };
  });
}

export interface Interval {
  lo: number;
  hi: number;
}

export interface Bootstrap {
  samples: number;
  /** The 95% intervals for each contestant's headline Gut Score and Skill. */
  intervals: Map<string, { gutScore: Interval; skill: Interval }>;
  /** Returns the share of resamples in which a beats b on Gut Score, with ties counting half. */
  ahead(a: string, b: string): number;
}

/**
 * Resamples items with replacement inside each pack and rescores every
 * contestant on the same resample against the pack's own base rate, so the
 * intervals and the head-to-head shares reflect which items happened to be in
 * the pack. The seed makes a report reproducible.
 */
export function bootstrap(
  packs: Map<string, Item[]>,
  predictions: Prediction[],
  opts: ScoreOptions & { samples?: number; seed?: number } = {},
): Bootstrap {
  const samples = opts.samples ?? 1000;
  const random = rng(opts.seed ?? 1);
  const { contestants, evaluated, rowsFor } = collect(packs, predictions);
  const headline = [...headlineOf([...evaluated.keys()], opts)];
  const rows = new Map(contestants.map((c) => [c, new Map(headline.map((pack) => [pack, rowsFor(c, pack)]))]));
  // The base rate belongs to the pack, so every resample keeps the full pack's
  // base rate. Recomputing it from each resample would hand the reference
  // forecaster that resample's mean and bias every interval downward.
  const bases = new Map(headline.map((pack) => [pack, mean(evaluated.get(pack)!.map((item) => item.truth.value))]));
  const gut = new Map(contestants.map((c) => [c, [] as number[]]));
  const skill = new Map(contestants.map((c) => [c, [] as number[]]));

  for (let s = 0; s < samples; s++) {
    const picks = new Map(headline.map((pack) => {
      const n = evaluated.get(pack)!.length;
      return [pack, Array.from({ length: n }, () => Math.floor(random() * n))];
    }));
    for (const c of contestants) {
      const scored = headline.map((pack) => {
        const own = rows.get(c)!.get(pack)!;
        return skills(picks.get(pack)!.map((i) => own[i]), bases.get(pack));
      });
      gut.get(c)!.push(mean(scored.map((x) => x.gutScore)));
      skill.get(c)!.push(mean(scored.map((x) => x.skill)));
    }
  }

  const interval = (xs: number[]): Interval => ({ lo: quantile(xs, 0.025) ?? NaN, hi: quantile(xs, 0.975) ?? NaN });
  return {
    samples,
    intervals: new Map(contestants.map((c) => [c, { gutScore: interval(gut.get(c)!), skill: interval(skill.get(c)!) }])),
    ahead(a, b) {
      const xa = gut.get(a)!;
      const xb = gut.get(b)!;
      return mean(xa.map((x, i) => (x > xb[i] ? 1 : x === xb[i] ? 0.5 : 0)));
    },
  };
}
