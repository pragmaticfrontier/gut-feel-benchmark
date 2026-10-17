import type { Item } from '../types.ts';
import { rng, shuffle } from '../random.ts';

/**
 * The pack takes Hacker News stories posted 7 to 14 days before the build and
 * scores each by whether it reached 100 points. The week's wait lets scores
 * settle, and a pack built after a model's training cutoff cannot have been memorised.
 * Rebuild it for every release to keep it that way.
 */
const API = 'https://hn.algolia.com/api/v1/search_by_date';
const THRESHOLD = 100;
const DAY = 86400;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Hit {
  objectID: string;
  title?: string;
  url?: string | null;
  points?: number | null;
  created_at_i: number;
}

async function fetchWindow(from: number, to: number): Promise<Hit[]> {
  const url = `${API}?tags=story&hitsPerPage=1000&numericFilters=created_at_i>=${from},created_at_i<${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hacker News API failed: HTTP ${res.status}`);
  const body = (await res.json()) as { hits: Hit[]; nbHits: number };
  // Algolia returns at most 1,000 hits per query; split busy windows in half.
  if (body.nbHits > body.hits.length && to - from > 600) {
    const mid = Math.floor((from + to) / 2);
    return [...(await fetchWindow(from, mid)), ...(await fetchWindow(mid, to))];
  }
  return body.hits;
}

function site(url: string | null | undefined): string {
  if (!url) return 'news.ycombinator.com (text post)';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export async function buildHn({ size = 200, positiveShare = 0.25, seed = 5, asOf = new Date() } = {}): Promise<Item[]> {
  const end = Math.floor(asOf.getTime() / 1000) - 7 * DAY;
  const start = end - 7 * DAY;
  const hits: Hit[] = [];
  for (let t = start; t < end; t += DAY / 4) hits.push(...(await fetchWindow(t, Math.min(end, t + DAY / 4))));

  const stories = hits.filter((h) => h.title && typeof h.points === 'number');
  const random = rng(seed);
  const positives = shuffle(stories.filter((h) => h.points! >= THRESHOLD), random);
  const negatives = shuffle(stories.filter((h) => h.points! < THRESHOLD), random);
  const nPos = Math.min(positives.length, Math.round(size * positiveShare));
  const nNeg = Math.min(negatives.length, Math.round(nPos * (1 - positiveShare) / positiveShare));
  const share = `${Math.round((nPos / (nPos + nNeg)) * 100)}%`;

  const chosen = shuffle([...positives.slice(0, nPos), ...negatives.slice(0, nNeg)], random);
  return chosen.map((h, i): Item => {
    const posted = new Date(h.created_at_i * 1000);
    return {
      id: `hn-${String(i + 1).padStart(3, '0')}`,
      pack: 'hn-frontpage',
      state: {
        title: h.title!,
        site: site(h.url),
        posted: `${WEEKDAYS[posted.getUTCDay()]} ${String(posted.getUTCHours()).padStart(2, '0')}:00 UTC`,
      },
      question: {
        instructions: `This Hacker News story reached at least ${THRESHOLD} points. In this pack, ${share} of stories did.`,
      },
      truth: { kind: 'outcome', value: h.points! >= THRESHOLD ? 1 : 0 },
      meta: { hnId: h.objectID, points: h.points!, postedAt: posted.toISOString(), scoredAt: asOf.toISOString() },
    };
  });
}
