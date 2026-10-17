import type { Item } from '../types.ts';
import { rng, shuffle } from '../random.ts';

// Cards are 0..51: rank = card % 13 (0 is a deuce, 12 an ace), suit = card / 13.
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];

export function cardName(card: number): string {
  return RANKS[card % 13] + SUITS[Math.floor(card / 13)];
}

// Hand values are category * 13^5 plus up to five ranks in base 13, so a
// larger number is always the better hand and equal numbers split the pot.
const W = [28561, 2197, 169, 13, 1];
const CATEGORY = 371293;

function straightHigh(mask: number): number {
  for (let hi = 12; hi >= 4; hi--) {
    const need = 0b11111 << (hi - 4);
    if ((mask & need) === need) return hi;
  }
  // The wheel, A-2-3-4-5, plays the ace low.
  return (mask & 0b1000000001111) === 0b1000000001111 ? 3 : -1;
}

/** Encodes the n highest ranks in mask, starting at weight slot `from`. */
function topRanks(mask: number, n: number, from = 0): number {
  let value = 0;
  let taken = 0;
  for (let r = 12; r >= 0 && taken < n; r--) {
    if (mask & (1 << r)) value += r * W[from + taken++];
  }
  return value;
}

function highestRank(mask: number): number {
  return mask === 0 ? -1 : 31 - Math.clz32(mask);
}

// The scratch buffers are reused across calls, because the evaluator runs
// hundreds of millions of times while a pack is built.
const counts = new Int8Array(13);
const suitCount = new Int8Array(4);
const suitMask = new Int32Array(4);

/** Returns the value of the best five-card hand among seven cards. */
export function evaluate7(cards: ArrayLike<number>): number {
  counts.fill(0);
  suitCount.fill(0);
  suitMask.fill(0);
  let mask = 0;
  for (let i = 0; i < 7; i++) {
    const c = cards[i];
    const r = c % 13;
    const s = (c / 13) | 0;
    counts[r]++;
    suitCount[s]++;
    suitMask[s] |= 1 << r;
    mask |= 1 << r;
  }

  // Seven cards cannot hold a flush together with quads or a full house,
  // so a flush settles the hand.
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) {
      const high = straightHigh(suitMask[s]);
      if (high >= 0) return 8 * CATEGORY + high * W[0];
      return 5 * CATEGORY + topRanks(suitMask[s], 5);
    }
  }

  let quad = -1;
  let trip1 = -1;
  let trip2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  let pair3 = -1;
  let singles = 0;
  for (let r = 12; r >= 0; r--) {
    const n = counts[r];
    if (n === 4) quad = r;
    else if (n === 3) {
      if (trip1 < 0) trip1 = r;
      else trip2 = r;
    } else if (n === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
      else pair3 = r;
    } else if (n === 1) singles |= 1 << r;
  }

  if (quad >= 0) {
    return 7 * CATEGORY + quad * W[0] + highestRank(mask & ~(1 << quad)) * W[1];
  }
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    return 6 * CATEGORY + trip1 * W[0] + Math.max(trip2, pair1) * W[1];
  }
  const high = straightHigh(mask);
  if (high >= 0) return 4 * CATEGORY + high * W[0];
  if (trip1 >= 0) return 3 * CATEGORY + trip1 * W[0] + topRanks(singles, 2, 1);
  if (pair2 >= 0) {
    const kicker = Math.max(pair3, highestRank(singles));
    return 2 * CATEGORY + pair1 * W[0] + pair2 * W[1] + kicker * W[2];
  }
  if (pair1 >= 0) return 1 * CATEGORY + pair1 * W[0] + topRanks(singles, 3, 1);
  return topRanks(singles, 5);
}

export interface Equity {
  win: number;
  tie: number;
  boards: number;
}

/** Computes exact all-in equity over every one of the C(48,5) = 1,712,304 boards. */
export function exactEquity(a: readonly number[], b: readonly number[]): Equity {
  const used = new Set([...a, ...b]);
  const deck = Array.from({ length: 52 }, (_, i) => i).filter((c) => !used.has(c));
  const ha = new Int32Array(7);
  const hb = new Int32Array(7);
  ha[0] = a[0];
  ha[1] = a[1];
  hb[0] = b[0];
  hb[1] = b[1];
  let win = 0;
  let tie = 0;
  let boards = 0;
  const n = deck.length;
  for (let i = 0; i < n - 4; i++) {
    ha[2] = hb[2] = deck[i];
    for (let j = i + 1; j < n - 3; j++) {
      ha[3] = hb[3] = deck[j];
      for (let k = j + 1; k < n - 2; k++) {
        ha[4] = hb[4] = deck[k];
        for (let l = k + 1; l < n - 1; l++) {
          ha[5] = hb[5] = deck[l];
          for (let m = l + 1; m < n; m++) {
            ha[6] = hb[6] = deck[m];
            const va = evaluate7(ha);
            const vb = evaluate7(hb);
            if (va > vb) win++;
            else if (va === vb) tie++;
            boards++;
          }
        }
      }
    }
  }
  return { win: win / boards, tie: tie / boards, boards };
}

/** A Monte Carlo estimate picks which matchups enter the pack; exactEquity sets their truth. */
export function sampledEquity(a: readonly number[], b: readonly number[], n: number, random: () => number): Equity {
  const used = new Set([...a, ...b]);
  const deck = Array.from({ length: 52 }, (_, i) => i).filter((c) => !used.has(c));
  const ha = new Int32Array([a[0], a[1], 0, 0, 0, 0, 0]);
  const hb = new Int32Array([b[0], b[1], 0, 0, 0, 0, 0]);
  let win = 0;
  let tie = 0;
  for (let t = 0; t < n; t++) {
    for (let i = 0; i < 5; i++) {
      const j = i + Math.floor(random() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
      ha[2 + i] = hb[2 + i] = deck[i];
    }
    const va = evaluate7(ha);
    const vb = evaluate7(hb);
    if (va > vb) win++;
    else if (va === vb) tie++;
  }
  return { win: win / n, tie: tie / n, boards: n };
}

const INSTRUCTIONS = 'Player A wins the pot at showdown. A split pot counts as half a win.';

export function pokerItem(id: string, a: readonly number[], b: readonly number[], equity: Equity): Item {
  const hand = (cards: readonly number[]) => cards.map(cardName).join(' ');
  return {
    id,
    pack: 'poker-equity',
    state: [
      "Heads-up no-limit Texas hold'em. Both players are all in before the flop,",
      'so all five community cards will be dealt with no more betting.',
      `Player A: ${hand(a)}`,
      `Player B: ${hand(b)}`,
    ].join('\n'),
    question: { instructions: INSTRUCTIONS },
    truth: { kind: 'probability', value: round(equity.win + equity.tie / 2) },
    meta: { handA: hand(a), handB: hand(b), win: round(equity.win), tie: round(equity.tie), boards: equity.boards },
  };
}

/**
 * Matchups are drawn at random and kept until each tenth of the probability
 * range holds the same number of them. Left to chance, 84% of deals land
 * between 30% and 70% equity, and the pack would say little about long shots.
 */
export function buildPoker({ size = 100, seed = 42, log = (_: string) => {} } = {}): Item[] {
  const random = rng(seed);
  const perBin = Math.ceil(size / 10);
  const bins: { a: number[]; b: number[]; equity: Equity }[][] = Array.from({ length: 10 }, () => []);
  const binOf = (p: number) => Math.min(9, Math.floor(p * 10));
  const open = (p: number) => bins[binOf(p)].length < perBin;
  const seen = new Set<string>();

  for (let n = 0, tries = 0; n < size && tries < 200000; tries++) {
    const cards = shuffle(Array.from({ length: 52 }, (_, i) => i), random).slice(0, 4);
    const a = cards.slice(0, 2);
    const b = cards.slice(2, 4);
    const key = [a.slice().sort().join(','), b.slice().sort().join(',')].sort().join('|');
    if (seen.has(key)) continue;

    // A quick estimate skips matchups headed for a full bin before the exact count runs.
    const est = sampledEquity(a, b, 1000, random);
    const guess = est.win + est.tie / 2;
    if (est.tie > 0.05 || (!open(guess) && !open(1 - guess))) continue; // near-identical hands mostly chop
    seen.add(key);

    const equity = exactEquity(a, b);
    if (equity.tie > 0.05) continue;
    const p = equity.win + equity.tie / 2;
    const seats = [
      { a, b, equity, bin: binOf(p) },
      { a: b, b: a, equity: { win: 1 - equity.win - equity.tie, tie: equity.tie, boards: equity.boards }, bin: binOf(1 - p) },
    ].filter((seat) => bins[seat.bin].length < perBin);
    if (!seats.length) continue;
    const seat = seats.reduce((x, y) => (bins[y.bin].length < bins[x.bin].length ? y : x));
    bins[seat.bin].push(seat);
    n++;
    log(`${seat.a.map(cardName).join(' ')} vs ${seat.b.map(cardName).join(' ')}: ${(seat.equity.win + seat.equity.tie / 2).toFixed(4)}`);
  }

  return shuffle(bins.flat(), random).map(({ a, b, equity }, i) =>
    pokerItem(`poker-${String(i + 1).padStart(3, '0')}`, a, b, equity),
  );
}

function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}
