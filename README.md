# Gut Feel Benchmark

The Gut Feel Benchmark measures how good a model's snap probability is and how long the model takes to give it. Each item is a situation an expert would size up at a glance: two poker hands all in before the flop, a positive screening test, a patient's cardiology work-up, a Hacker News story posted last week. The model returns one number, the probability that a statement about the situation is true. The benchmark scores that number against the exact probability where one can be computed, and against what happened where it cannot.

Speed is part of the score because intuition is valuable only when it arrives before the decision it informs. Kahneman and Klein (2009) place trustworthy intuition in fields that are regular enough to learn and quick to give feedback, such as chess and firefighting, where experts answer in seconds. Models now reach an answer by two routes. A chat model writes it as text, sometimes after thousands of tokens of reasoning, while a decision model such as Jev returns the probability directly in a fraction of a second. The benchmark puts both routes on one scale: forecast skill at deadlines from a quarter of a second to 16 seconds.

## Every item is a Jev request

Jev is TypeSafe AI's "System One" decision model, released on 15 September 2026. It takes a state and a set of typed questions, and it returns a probability for each allowed answer without generating any text. Vercel AI Gateway lists it at $0.042 per million input tokens. AI SDK 7 exposes the same interface for any decision model as `experimental_decide`, and the benchmark sends every item to every contestant through that one function:

```ts
import { experimental_decide } from 'ai';

const result = await experimental_decide({
  model: 'typesafe-ai/jev',
  state: [
    "Heads-up no-limit Texas hold'em. Both players are all in before the flop,",
    'so all five community cards will be dealt with no more betting.',
    'Player A: 4♣ 10♣',
    'Player B: 3♥ A♥',
  ].join('\n'),
  questions: {
    answer: {
      type: 'boolean',
      instructions: 'Player A wins the pot at showdown. A split pot counts as half a win.',
    },
  },
});

result.answers.answer.probability; // the forecast, against an exact equity of 0.4113
```

Native decision models answer this request directly. The default roster has three of them on AI Gateway: Jev, Microsoft-Decision-1 and OpenAI's Decisions API. Chat models answer through an adapter, `src/llm-decision-model.ts`, which turns the same request into a structured-output call that returns P(true). Every contestant therefore reads identical text and is timed over the same network path.

Each item asks one boolean question because boolean is the only type for which every provider returns a probability. The AI SDK's own Anthropic and Google adapters return P(true) for boolean questions but no distribution for choice or score questions, so a choice item could not be scored as a probability across the whole field.

## Four packs, 703 items

| Pack | What the expert sees | Truth | Items | Base rate |
|---|---|---|---:|---:|
| `poker-equity` | Two hold'em hands, all in before the flop | Exact equity over all 1,712,304 boards | 100 | 0.499 |
| `base-rates` | A screening test's prevalence, hit rate and false-positive rate, and a positive result | Exact posterior by Bayes' rule | 100 | 0.497 |
| `heart-disease` | Thirteen findings from a cardiology work-up | Angiogram shows more than 50% narrowing in a major artery | 303 | 0.459 |
| `hn-frontpage` | A story's title, site and posting time | The story reached 100 points | 200 | 0.250 |

Two packs carry exact truths, which takes sampling noise out of the score. A forecast of 0.70 for a hand whose equity is 0.72 is scored against 0.72, not against the result of one showdown. The evaluator behind the poker truths reproduces the figure equity calculators give for aces against kings with no shared suit: 81.06% wins and 0.38% splits.

The two exact packs test opposite ends of intuition. Poker meets both of Kahneman and Klein's conditions, since the rules never change and each hand ends within minutes. Base-rate problems are where expert intuition breaks: Gigerenzer and colleagues (2007) gave 160 gynaecologists a mammography problem of this form, and 21% chose the right answer. Both packs hold exactly 10 items in each tenth of the probability range, so calibration is tested on long shots and near-locks as well as close calls. Left to chance, 84% of poker deals land between 30% and 70% equity, and fewer than 4% fall below 20% or above 80%.

The two outcome packs test judgement on real cases. `heart-disease` is the Cleveland Clinic set from the UCI repository: 303 patients referred for angiography between 1981 and 1984, of whom 139 had disease. The set has been public since 1988 and is a standard teaching dataset, so models have probably seen it, and a high score there may reflect memory as well as judgement. The report scores it in full but keeps it out of the headline Gut Score and Skill. `hn-frontpage` closes that gap. It samples stories posted 7 to 14 days before the build, which for the shipped file means 2 to 9 October 2026, and labels each by whether it reached 100 points. Of the 6,889 stories posted that week, 4.0% did. The pack raises that share to 25% and states it in the question, so a model is judged on telling stories apart and not on guessing a rate. Rebuilding the pack before each run keeps every story less than two weeks old at test time.

## Scoring

Skill is the Brier skill score against the pack's base rate:

```
skill = 1 - mean((q - t)^2) / mean((b - t)^2)
```

Here q is the forecast, t is the truth (an outcome of 0 or 1, or an exact probability) and b is the pack's base rate. A score of 0 means the forecast is no better than knowing how common the outcome is, 1 means a perfect forecast, and a negative score means a forecast worse than the base rate. A constant forecast cannot score above 0, so a model that answers 0.5 to everything gains nothing.

Speed enters through deadlines. At each of seven deadlines (0.25, 0.5, 1, 2, 4, 8 and 16 seconds), any answer slower than the deadline is replaced by the base rate and the pack is scored again. The result is capped at the pack's skill with no deadline, so a late answer can lower a score but never raise it. Without the cap, a forecaster worse than the base rate would move toward 0 by answering slowly. The Gut Score is the mean skill over the seven deadlines, times 100, averaged across the three headline packs. A perfect forecaster that answers in 300 ms scores 85.7, and the same forecaster answering in 3 seconds scores 42.9 because it misses four of the seven deadlines. A failed call also counts as the base rate, so errors cost skill without stopping the run.

The report adds skill with no deadline, log loss, calibration error over ten bins, accuracy at 0.5, median and 95th-percentile latency, and cost per 1,000 decisions at AI Gateway's list prices. Each headline score carries a 95% interval from 1,000 paired bootstrap resamples of the items, and each leaderboard row gives the share of resamples in which the contestant beats the next one down. A gap is a ranking only when that share reaches 95%. A contestant asked only part of a run is ranked in its own table on the items it answered, so the items it was never asked do not count against it.

Latency is wall-clock time on the machine running the benchmark, with the network and Gateway included. Each session times five Gateway requests that do no model work and prints the median in the report as the network floor. Each contestant makes one untimed warm-up call before its timed ones, retries are off, and four requests run at once by default. For chat models the runner also records reasoning tokens and SDK warnings for every answer, so the report shows whether reasoning stayed off when the spec asked for it.

## Contestants

A contestant is a spec string that names a model and the way it answers.

| Spec | What runs |
|---|---|
| `decide:typesafe-ai/jev` | A native decision model on AI Gateway; the `decide:` prefix is optional |
| `llm:anthropic/claude-opus-5.5` | A Gateway chat model answering through structured output, with reasoning off |
| `llm:anthropic/claude-opus-5.5@high` | The same model with a reasoning budget of `minimal`, `low`, `medium`, `high`, `xhigh` or `max` |
| `human:alex` | A person answering in the terminal, timed from the moment each item appears |
| `mock:oracle`, `mock:coin` | Offline contestants for tests: a noisy oracle with a 300 ms median latency, and a constant 0.5 |

The default roster runs nine contestants: Jev, Microsoft-Decision-1 and OpenAI's Decisions API, then Claude Opus 5.5, GPT-6.1 Sol and Gemini 3.8 Flash, each with reasoning off and again with high reasoning. Running each chat model both ways isolates the trade the benchmark exists to measure: what deliberation adds to a forecast, and what it costs on the clock. The high-reasoning entries run last because they cost the most.

A `human:` contestant puts a person in the same table. The runner prints each item as a chat model would see it, takes a percentage from 0 to 100, and times the answer from the moment the item appears, one item at a time and with no time limit. A poker player answering `poker-equity`, or a doctor answering `heart-disease`, gives the expert baseline the packs lack.

## Running it

The benchmark needs Node 22 or later and a Vercel AI Gateway key.

```bash
npm install
echo 'AI_GATEWAY_API_KEY=your-key' > .env

npm run bench -- --limit 25    # runs 25 items per pack for every default contestant
npm run bench                  # runs all 703 items
npm run bench -- --models decide:typesafe-ai/jev,llm:openai/gpt-6.1-sol@high --packs poker-equity,base-rates
npm run bench -- --models human:alex --packs poker-equity --limit 25 --run 2026-10-17   # adds a person to a run
npm run report -- --run 2026-10-17

npm run build:data             # rebuilds the packs and refetches hn-frontpage
npm test                       # runs the offline suite with no key
```

Each run writes to `results/<run>/`, named by date unless `--run` names it. `predictions.jsonl` holds one line per contestant and item, `report.md` holds the tables, and `summary.json` holds the same numbers for scripts. Runs resume: an item that has an answer is never sent again, and a failed item is retried on the next run. `--concurrency` sets the number of parallel requests and `--timeout` the limit per call in milliseconds.

## Results

The full run, on 17 October 2026, put all 703 items to six contestants. The headline averages poker-equity, base-rates and hn-frontpage, the intervals are 95% paired bootstrap intervals over items, and the run's files are in `results/2026-10-17/`.

| Contestant | Gut Score | 95% interval | Skill | Median latency |
|---|---:|---:|---:|---:|
| OpenAI Decisions API (`gpt-6-luna-decisions`) | 61.8 | 60.2 to 63.2 | 64.7 | 0.20 s |
| Jev | 45.6 | 41.4 to 48.8 | 51.7 | 0.26 s |
| Microsoft-Decision-1 | 32.2 | 25.7 to 37.2 | 39.9 | 0.29 s |
| Claude Opus 5.5, reasoning off | 30.8 | 28.5 to 33.0 | 69.3 | 1.8 s |
| Claude Opus 5.5, high reasoning | 26.2 | 24.6 to 27.9 | 70.3 | 3.1 s |
| GPT-6.1 Sol, reasoning off | 11.4 | 3.6 to 14.1 | 64.3 | 6.1 s |

The decision models win on the clock and the chat models win on judgement. Claude Opus 5.5 has the highest skill in the field, 69.3 with reasoning off and 70.3 with high reasoning, but its median answer takes 1.8 to 3.1 seconds, so it scores nothing at the three shortest deadlines. OpenAI's Decisions API reaches 64.7 in 0.20 seconds and leads with 61.8, and Jev is second at 45.6. Speed sets the order.

Each contestant beats the next one down in at least 99% of bootstrap resamples, except Microsoft-Decision-1 against Opus with reasoning off, at 61%. With 400 headline items per contestant, the intervals are a third to a half as wide as in the trial run of 25 items per pack that came first.

High reasoning bought Opus one point of skill and cost it nearly five points of Gut Score. It used 132 reasoning tokens per answer instead of 27 and slowed from 1.8 to 3.1 seconds, and the skill gain sits inside both intervals. The reasoning-off setting held for neither chat model: Opus used 27 reasoning tokens per answer and GPT-6.1 Sol 118, with no SDK warning.

The exact packs separate the field and the outcome packs barely do. The chat models scored 100.0 on base-rates and 97.1 to 98.9 on poker-equity, against 99.9 and 93.4 for the Decisions API, 80.3 and 76.8 for Jev, and 67.3 and 52.6 for Microsoft-Decision-1. On hn-frontpage no contestant passed 12.1. On heart-disease, outside the headline, the chat models scored 62.4 to 70.3 and the decision models 40.2 to 46.4.

Gemini 3.8 Flash answered only the trial run's 100 items. It ran past the 120-second limit on 23 of 25 poker hands, and Gateway appears to bill such calls although they return nothing, so it sat out the full run. The report ranks it on its own items, where it scored 0.3 against 59.0 for the Decisions API. The full run cost $5.84 of Gateway credit, and 2 of its 4,218 calls failed.

## Status

Version 0.1 has one live run, the full run above. The 23 tests cover the hand evaluator, the Bayes generator, the scoring and its deadline cap, the bootstrap, the chat-model adapter, the terminal input for people, partial contestants in the report and a full mock run with resume.

Four gaps remain open:

- The bootstrap resamples items, so the intervals cover which items were drawn but not run-to-run variation in a model's answers or latency.
- The network floor shows how much of each latency is network, but latencies from two machines are still not comparable.
- The report shows when a provider ignores the request to switch reasoning off, but the runner cannot force it off.
- No human expert has answered a pack yet, although a `human:` contestant can.

The next packs should pair the truth with an expert reference: closing betting odds for sports results, and engine evaluations for chess positions. Choice and score questions can follow for the decision models that return full distributions.

## Layout

| Path | Contents |
|---|---|
| `src/packs/` | One builder per pack; `poker.ts` holds the hand evaluator and the exact enumeration |
| `src/llm-decision-model.ts` | The adapter that lets a chat model answer a Jev request |
| `src/contestants.ts` | Spec parsing and the offline mocks |
| `src/human-decision-model.ts` | Terminal input that lets a person answer as a contestant |
| `src/bench.ts` | The runner, with timing, resume and concurrency |
| `src/score.ts` | Skill, deadlines, log loss and calibration error |
| `src/report.ts` | The writer for `report.md` and `summary.json` |
| `data/` | The built packs, one JSON object per line |

## Sources and licences

The code is MIT-licensed. `heart-disease` comes from the UCI Machine Learning Repository (Janosi, Steinbrunn, Pfisterer and Detrano, 1988) under CC BY 4.0. `hn-frontpage` stores public story titles, sites and point counts from the Hacker News Algolia API, and the titles belong to their authors. The poker and base-rate packs are generated from fixed seeds and rebuild identically.

- Kahneman, D. and Klein, G. (2009). Conditions for intuitive expertise: a failure to disagree. *American Psychologist*, 64(6), 515-526.
- Gigerenzer, G., Gaissmaier, W., Kurz-Milcke, E., Schwartz, L. M. and Woloshin, S. (2007). Helping doctors and patients make sense of health statistics. *Psychological Science in the Public Interest*, 8(2), 53-96.
- TypeSafe AI (2026). [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev).
- Vercel (2026). [AI SDK decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) and [Jev on AI Gateway](https://vercel.com/ai-gateway/models/jev).
