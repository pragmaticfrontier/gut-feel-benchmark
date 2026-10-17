import type { Item, Json } from '../types.ts';
import { rng, shuffle } from '../random.ts';

/**
 * UCI Heart Disease holds Cleveland Clinic records (Janosi, Steinbrunn,
 * Pfisterer and Detrano, 1988; CC BY 4.0) for 303 patients referred for
 * coronary angiography. The angiogram is the truth: disease means more than 50%
 * narrowing in at least one major vessel.
 */
export const HEART_URL =
  'https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data';

const CHEST_PAIN: Record<string, string> = {
  '1': 'typical angina',
  '2': 'atypical angina',
  '3': 'non-anginal pain',
  '4': 'asymptomatic',
};
const RESTING_ECG: Record<string, string> = {
  '0': 'normal',
  '1': 'ST-T wave abnormality',
  '2': 'probable or definite left ventricular hypertrophy',
};
const ST_SLOPE: Record<string, string> = { '1': 'upsloping', '2': 'flat', '3': 'downsloping' };
const THALLIUM: Record<string, string> = { '3': 'normal', '6': 'fixed defect', '7': 'reversible defect' };

const INSTRUCTIONS = 'Coronary angiography shows more than 50% narrowing in at least one major coronary artery.';

export function parseHeart(csv: string, { seed = 11 } = {}): Item[] {
  const rows = csv
    .trim()
    .split('\n')
    // The file writes codes as floats ("1.0"); normalise them to "1".
    .map((line) => line.trim().split(',').map((v) => (v === '?' ? v : String(Number(v)))));

  const items = rows.map((r, i): Item => {
    const [age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal, num] = r;
    const known = (v: string) => v !== '?';
    const state: { [key: string]: Json } = {
      setting: 'Referred to the Cleveland Clinic for evaluation of suspected coronary artery disease, 1981 to 1984',
      age: Number(age),
      sex: sex === '1' ? 'male' : 'female',
      'chest pain': CHEST_PAIN[cp] ?? 'unknown',
      'resting blood pressure': `${Number(trestbps)} mm Hg`,
      'serum cholesterol': `${Number(chol)} mg/dl`,
      'fasting blood sugar above 120 mg/dl': fbs === '1',
      'resting ECG': RESTING_ECG[restecg] ?? 'unknown',
      'maximum heart rate on exercise test': Number(thalach),
      'exercise-induced angina': exang === '1',
      'ST depression on exercise relative to rest': `${Number(oldpeak)} mm`,
      'slope of peak exercise ST segment': ST_SLOPE[slope] ?? 'unknown',
      'major vessels coloured by fluoroscopy': known(ca) ? Number(ca) : 'unknown',
      'thallium stress scan': known(thal) ? THALLIUM[thal] ?? 'unknown' : 'unknown',
    };
    return {
      id: `heart-${String(i + 1).padStart(3, '0')}`,
      pack: 'heart-disease',
      state,
      question: { instructions: INSTRUCTIONS },
      truth: { kind: 'outcome', value: Number(num) > 0 ? 1 : 0 },
      meta: { sourceRow: i + 1 },
    };
  });

  // The build shuffles items once, so `--limit n` takes a random sample.
  return shuffle(items, rng(seed));
}

export async function buildHeart(): Promise<Item[]> {
  const res = await fetch(HEART_URL);
  if (!res.ok) throw new Error(`UCI download failed: HTTP ${res.status}`);
  return parseHeart(await res.text());
}
