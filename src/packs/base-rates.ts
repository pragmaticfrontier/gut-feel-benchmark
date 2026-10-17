import type { Item } from '../types.ts';
import { rng, shuffle } from '../random.ts';

/**
 * Each screening problem pairs a rare condition with an imperfect test and a
 * positive result. The answer is P(condition | positive) by Bayes' rule. Intuition anchors on
 * the test's hit rate and ignores how rare the condition is; this pack
 * measures how far a model's gut sits from the arithmetic.
 */
interface Scenario {
  name: string;
  state: (prev: string, sens: string, fpr: string) => string;
  instructions: string;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'mammography',
    state: (prev, sens, fpr) =>
      `A 45-year-old woman with no symptoms has a routine screening mammogram. Among women like her, ${prev} have breast cancer. ` +
      `A mammogram detects ${sens} of cancers that are present and gives a false positive for ${fpr} of women without cancer. Her mammogram is positive.`,
    instructions: 'This woman has breast cancer.',
  },
  {
    name: 'card-fraud',
    state: (prev, sens, fpr) =>
      `A bank's fraud model reviews card transactions. ${cap(prev)} of transactions are fraudulent. ` +
      `The model flags ${sens} of fraudulent transactions and ${fpr} of legitimate ones. It has just flagged a transaction.`,
    instructions: 'The flagged transaction is fraudulent.',
  },
  {
    name: 'drug-test',
    state: (prev, sens, fpr) =>
      `A company drug-tests every job applicant. ${cap(prev)} of applicants use the drug. ` +
      `The test catches ${sens} of users and wrongly flags ${fpr} of non-users. An applicant's test comes back positive.`,
    instructions: 'This applicant uses the drug.',
  },
  {
    name: 'board-inspection',
    state: (prev, sens, fpr) =>
      `A factory's optical inspection checks circuit boards. ${cap(prev)} of boards have a solder defect. ` +
      `The camera rejects ${sens} of defective boards and ${fpr} of good boards by mistake. It has just rejected a board.`,
    instructions: 'The rejected board has a solder defect.',
  },
  {
    name: 'intrusion-alert',
    state: (prev, sens, fpr) =>
      `An intrusion detector watches logins to a company network. ${cap(prev)} of login attempts come from attackers. ` +
      `The detector raises an alert on ${sens} of attacker logins and on ${fpr} of legitimate ones. It has raised an alert on a login.`,
    instructions: 'This login comes from an attacker.',
  },
  {
    name: 'hiring-screen',
    state: (prev, sens, fpr) =>
      `A software company gives every applicant a timed coding screen. ${cap(prev)} of applicants would do well in the job. ` +
      `The screen passes ${sens} of applicants who would do well and ${fpr} of those who would not. An applicant has passed.`,
    instructions: 'This applicant would do well in the job.',
  },
  {
    name: 'strep-test',
    state: (prev, sens, fpr) =>
      `A child with a sore throat gets a rapid strep test at a walk-in clinic. Among children with these symptoms, ${prev} have strep throat. ` +
      `The test is positive for ${sens} of children with strep and for ${fpr} of children without it. The child's test is positive.`,
    instructions: 'This child has strep throat.',
  },
  {
    name: 'phishing-filter',
    state: (prev, sens, fpr) =>
      `An email filter screens incoming mail at a large company. ${cap(prev)} of incoming emails are phishing. ` +
      `The filter flags ${sens} of phishing emails and ${fpr} of genuine ones. It has flagged an email.`,
    instructions: 'The flagged email is phishing.',
  },
];

export function posterior(prevalence: number, sensitivity: number, falsePositiveRate: number): number {
  const hit = prevalence * sensitivity;
  return hit / (hit + (1 - prevalence) * falsePositiveRate);
}

/** Formats percentages as a screening leaflet prints them, with one decimal below 1% and whole numbers above. */
function percent(x: number): string {
  return x < 0.01 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`;
}

/** Round to the precision that `percent` prints, so the truth matches the text exactly. */
function printed(x: number): number {
  return x < 0.01 ? Math.round(x * 1000) / 1000 : Math.round(x * 100) / 100;
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function logUniform(random: () => number, lo: number, hi: number): number {
  return Math.exp(Math.log(lo) + random() * (Math.log(hi) - Math.log(lo)));
}

/** Problems are kept so that the true posterior spreads evenly over ten bins. */
export function buildBaseRates({ size = 100, seed = 7 } = {}): Item[] {
  const random = rng(seed);
  const perBin = Math.ceil(size / 10);
  const bins: Item[][] = Array.from({ length: 10 }, () => []);
  let n = 0;

  for (let tries = 0; n < size && tries < 100000; tries++) {
    const prev = printed(logUniform(random, 0.002, 0.4));
    const sens = printed(0.6 + random() * 0.39);
    const fpr = printed(logUniform(random, 0.005, 0.2));
    if (prev <= 0 || fpr <= 0) continue;
    const truth = posterior(prev, sens, fpr);
    const bin = Math.min(9, Math.floor(truth * 10));
    if (bins[bin].length >= perBin) continue;
    const scenario = SCENARIOS[Math.floor(random() * SCENARIOS.length)];
    bins[bin].push({
      id: '',
      pack: 'base-rates',
      state: scenario.state(percent(prev), percent(sens), percent(fpr)),
      question: { instructions: scenario.instructions },
      truth: { kind: 'probability', value: Math.round(truth * 1e6) / 1e6 },
      meta: { scenario: scenario.name, prevalence: prev, sensitivity: sens, falsePositiveRate: fpr },
    });
    n++;
  }

  return shuffle(bins.flat(), random).map((item, i) => ({ ...item, id: `base-rates-${String(i + 1).padStart(3, '0')}` }));
}
