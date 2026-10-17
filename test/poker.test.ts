import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPack } from '../src/packs/index.ts';
import { evaluate7, exactEquity } from '../src/packs/poker.ts';

// card = suit * 13 + rank, rank 0 is a deuce and 12 an ace.
const c = (rank: string, suit: number) => suit * 13 + '23456789TJQKA'.indexOf(rank);
const hand = (spec: string) => spec.split(' ').map((s) => c(s[0], 'shdc'.indexOf(s[1])));

test('hand categories rank in the right order', () => {
  const ladder = [
    'As Ks Qs Js Ts 2d 3c', // royal flush
    '9h 9d 9s 9c Kd 2s 3h', // quads
    'Kh Kd Ks 2c 2d 7s 8h', // full house
    'Ah 9h 7h 4h 2h Kd Qc', // flush
    '5d 6c 7h 8s 9d 2c 2h', // straight
    'Ah 2c 3d 4s 5h Kc 9d', // wheel straight, ace low
    'Qh Qd Qs 2c 5d 7s 9h', // trips
    'Jh Jd 4s 4c Ad 7s 9h', // two pair
    'Th Td 2s 5c Ad 7s 9h', // one pair
    'Ah Kd 9s 7c 5d 3s 2h', // high card
  ].map((h) => evaluate7(hand(h)));
  for (let i = 1; i < ladder.length; i++) assert.ok(ladder[i - 1] > ladder[i], `rung ${i - 1} should beat rung ${i}`);
});

test('kickers decide between equal pairs and a board can split the pot', () => {
  assert.ok(evaluate7(hand('Ah Ad Ks 7c 5d 3s 2h')) > evaluate7(hand('As Ac Qs 7d 5c 3h 2d')));
  // Both players play the board straight.
  assert.equal(evaluate7(hand('2h 3d 9s Tc Jd Qs Kh')), evaluate7(hand('2c 4s 9s Tc Jd Qs Kh')));
});

test('exact equity matches the calculator figure for aces against kings', () => {
  const e = exactEquity(hand('As Ah'), hand('Kd Kc'));
  assert.equal(e.boards, 1712304);
  assert.ok(Math.abs(e.win - 0.8106) < 0.0005, `win ${e.win}`);
  assert.ok(Math.abs(e.tie - 0.0038) < 0.0005, `tie ${e.tie}`);
});

test('the shipped pack holds ten matchups in each tenth of the probability range', () => {
  const bins = Array(10).fill(0);
  for (const item of loadPack('data', 'poker-equity')) bins[Math.min(9, Math.floor(item.truth.value * 10))]++;
  assert.deepEqual(bins, Array(10).fill(10));
});
