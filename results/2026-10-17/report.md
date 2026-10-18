# Gut Feel Benchmark: run 2026-10-17

Generated 2026-10-17 22:32 UTC over poker-equity (100), base-rates (100), heart-disease (303), hn-frontpage (200).
Gut Score and Skill are Brier skill scores against the base rate, times 100, averaged over the headline packs: poker-equity, base-rates and hn-frontpage. heart-disease is scored below but kept out of the headline, because its records are public and a model may have memorised them.
Gut Score averages skill over seven deadlines from 0.25 s to 16 s. An answer that misses a deadline counts as the base rate, and no deadline scores above the skill of every answer.
The 95% intervals come from 1,000 paired bootstrap resamples of the items. "Ahead of next" is the share of resamples in which a contestant's Gut Score beats the next one down, and below 95% the two are not separated.

## Leaderboard

| Contestant | Gut Score | 95% interval | Ahead of next | Skill | 95% interval | p50 latency | p95 latency | Answered | Cost per 1,000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 61.8 | 60.2 to 63.2 | 100% | 64.7 | 63.4 to 65.9 | 195 ms | 364 ms | 702/703 | $0.02 |
| `decide:typesafe-ai/jev` | 45.6 | 41.4 to 48.8 | 100% | 51.7 | 47.2 to 55.1 | 264 ms | 368 ms | 703/703 | $0.02 |
| `decide:microsoft/microsoft-decision-1` | 32.2 | 25.7 to 37.2 | 61% | 39.9 | 32.3 to 46.1 | 294 ms | 690 ms | 703/703 | $0.0053 |
| `llm:anthropic/claude-opus-5.5` | 30.8 | 28.5 to 33.0 | 100% | 69.3 | 66.1 to 72.1 | 1.8 s | 5.1 s | 703/703 | $2.88 |
| `llm:anthropic/claude-opus-5.5@high` | 26.2 | 24.6 to 27.9 | 100% | 70.3 | 67.2 to 73.1 | 3.1 s | 6.7 s | 703/703 | $4.99 |
| `llm:openai/gpt-6.1-sol` | 11.4 | 3.6 to 14.1 | n/a | 64.3 | 56.7 to 70.1 | 6.1 s | 29.1 s | 702/703 | $1.81 |

## Skill by deadline

Each column averages the headline packs with every answer slower than the deadline counted as the base rate.

| Contestant | 0.25 s | 0.5 s | 1 s | 2 s | 4 s | 8 s | 16 s | No deadline |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 45.7 | 63.3 | 64.7 | 64.7 | 64.7 | 64.7 | 64.7 | 64.7 |
| `decide:typesafe-ai/jev` | 12.1 | 50.1 | 51.3 | 51.3 | 51.3 | 51.7 | 51.7 | 51.7 |
| `decide:microsoft/microsoft-decision-1` | -0.0 | 26.2 | 39.5 | 39.9 | 39.9 | 39.9 | 39.9 | 39.9 |
| `llm:anthropic/claude-opus-5.5` | 0.0 | 0.0 | -0.2 | 23.5 | 55.3 | 67.6 | 69.3 | 69.3 |
| `llm:anthropic/claude-opus-5.5@high` | 0.0 | 0.0 | 0.0 | 8.3 | 43.9 | 61.9 | 69.6 | 70.3 |
| `llm:openai/gpt-6.1-sol` | -1.4 | -1.4 | -1.4 | -1.4 | 13.3 | 33.1 | 38.8 | 64.3 |

## Skill by pack

| Contestant | poker-equity | base-rates | heart-disease (outside headline) | hn-frontpage |
| --- | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 93.4 | 99.9 | 40.2 | 0.9 |
| `decide:typesafe-ai/jev` | 76.8 | 80.3 | 44.9 | -2.0 |
| `decide:microsoft/microsoft-decision-1` | 52.6 | 67.3 | 46.4 | -0.1 |
| `llm:anthropic/claude-opus-5.5` | 98.5 | 100.0 | 62.4 | 9.4 |
| `llm:anthropic/claude-opus-5.5@high` | 98.9 | 100.0 | 70.3 | 12.1 |
| `llm:openai/gpt-6.1-sol` | 97.1 | 100.0 | 63.2 | -4.3 |

## poker-equity

Each item asks about heads-up hold'em equity with both players all in before the flop. The truth is an exact probability, and the base rate is 0.499 over 100 items.

| Contestant | Skill | Gut Score | Log loss | ECE | Accuracy | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 93.4 | 89.2 | 0.532 | 0.033 | 96.0 | 201 ms | 100/100 |
| `decide:typesafe-ai/jev` | 76.8 | 67.8 | 0.567 | 0.057 | 87.5 | 272 ms | 100/100 |
| `decide:microsoft/microsoft-decision-1` | 52.6 | 39.9 | 0.686 | 0.144 | 92.0 | 314 ms | 100/100 |
| `llm:anthropic/claude-opus-5.5` | 98.5 | 41.1 | 0.522 | 0.018 | 98.5 | 2.6 s | 100/100 |
| `llm:anthropic/claude-opus-5.5@high` | 98.9 | 28.4 | 0.521 | 0.014 | 99.0 | 4.9 s | 100/100 |
| `llm:openai/gpt-6.1-sol` | 97.1 | 4.0 | 0.524 | 0.009 | 98.5 | 22.3 s | 99/100 |

## base-rates

Each item asks about the chance of a condition after a positive screening test. The truth is an exact probability, and the base rate is 0.497 over 100 items.

| Contestant | Skill | Gut Score | Log loss | ECE | Accuracy | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 99.9 | 95.2 | 0.498 | 0.001 | 99.0 | 207 ms | 100/100 |
| `decide:typesafe-ai/jev` | 80.3 | 71.1 | 0.545 | 0.055 | 89.0 | 261 ms | 100/100 |
| `decide:microsoft/microsoft-decision-1` | 67.3 | 57.0 | 0.608 | 0.094 | 88.0 | 288 ms | 100/100 |
| `llm:anthropic/claude-opus-5.5` | 100.0 | 47.2 | 0.498 | 0.000 | 99.5 | 2.3 s | 100/100 |
| `llm:anthropic/claude-opus-5.5@high` | 100.0 | 45.2 | 0.498 | 0.000 | 99.5 | 2.4 s | 100/100 |
| `llm:openai/gpt-6.1-sol` | 100.0 | 34.5 | 0.498 | 0.000 | 100.0 | 4.6 s | 100/100 |

## heart-disease

Each item asks about coronary artery disease after a cardiology work-up. The truth is the observed outcome, and the base rate is 0.459 over 303 items. This pack is outside the headline score.

| Contestant | Skill | Gut Score | Log loss | ECE | Accuracy | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 40.2 | 38.9 | 0.477 | 0.070 | 79.0 | 194 ms | 303/303 |
| `decide:typesafe-ai/jev` | 44.9 | 40.2 | 0.436 | 0.083 | 81.8 | 266 ms | 303/303 |
| `decide:microsoft/microsoft-decision-1` | 46.4 | 39.4 | 0.419 | 0.071 | 81.8 | 295 ms | 303/303 |
| `llm:anthropic/claude-opus-5.5` | 62.4 | 31.9 | 0.319 | 0.088 | 88.4 | 1.8 s | 303/303 |
| `llm:anthropic/claude-opus-5.5@high` | 70.3 | 29.8 | 0.274 | 0.114 | 93.4 | 3.6 s | 303/303 |
| `llm:openai/gpt-6.1-sol` | 63.2 | 19.4 | 0.310 | 0.058 | 88.4 | 6.3 s | 303/303 |

## hn-frontpage

Each item asks about whether a Hacker News story reaches 100 points. The truth is the observed outcome, and the base rate is 0.250 over 200 items.

| Contestant | Skill | Gut Score | Log loss | ECE | Accuracy | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 0.9 | 0.9 | 0.558 | 0.016 | 75.0 | 190 ms | 199/200 |
| `decide:typesafe-ai/jev` | -2.0 | -2.0 | 0.570 | 0.098 | 75.0 | 262 ms | 200/200 |
| `decide:microsoft/microsoft-decision-1` | -0.1 | -0.3 | 0.567 | 0.060 | 75.0 | 291 ms | 200/200 |
| `llm:anthropic/claude-opus-5.5` | 9.4 | 4.1 | 0.507 | 0.076 | 75.8 | 1.6 s | 200/200 |
| `llm:anthropic/claude-opus-5.5@high` | 12.1 | 5.1 | 0.492 | 0.058 | 75.3 | 2.8 s | 200/200 |
| `llm:openai/gpt-6.1-sol` | -4.3 | -4.4 | 0.577 | 0.179 | 73.5 | 5.2 s | 200/200 |

## Partial run: `llm:google/gemini-3.8-flash`

`llm:google/gemini-3.8-flash` was asked 100 of the run's items and is left out of the tables above. Here every contestant is scored on those 100 items only.

| Contestant | Gut Score | Skill | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 59.0 | 65.1 | 301 ms | 100/100 |
| `decide:typesafe-ai/jev` | 51.3 | 57.2 | 264 ms | 100/100 |
| `decide:microsoft/microsoft-decision-1` | 37.5 | 46.8 | 299 ms | 100/100 |
| `llm:anthropic/claude-opus-5.5` | 32.0 | 71.2 | 2.0 s | 100/100 |
| `llm:anthropic/claude-opus-5.5@high` | 25.7 | 69.9 | 3.1 s | 100/100 |
| `llm:openai/gpt-6.1-sol` | 12.4 | 66.9 | 5.7 s | 100/100 |
| `llm:google/gemini-3.8-flash` | 0.3 | 28.8 | 12.3 s | 75/100 |

## Run notes

AI Gateway took a median of 56 ms to answer a request that does no model work, measured 3 times at the start of a session. Every latency above includes about that much network and Gateway time.

| Contestant | Reasoning asked | Reasoning tokens per answer | Warnings |
| --- | ---: | ---: | ---: |
| `llm:anthropic/claude-opus-5.5` | none | 26.8 | none |
| `llm:anthropic/claude-opus-5.5@high` | high | 131.8 | none |
| `llm:openai/gpt-6.1-sol` | none | 117.6 | none |

`llm:anthropic/claude-opus-5.5` was asked to answer with reasoning off but used 27 reasoning tokens per answer, so its latency and cost include reasoning.

`llm:openai/gpt-6.1-sol` was asked to answer with reasoning off but used 118 reasoning tokens per answer, so its latency and cost include reasoning.
