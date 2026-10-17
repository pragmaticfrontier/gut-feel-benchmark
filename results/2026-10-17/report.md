# Gut Feel Benchmark: run 2026-10-17

Generated 2026-10-17 19:52 UTC over poker-equity (25), base-rates (25), heart-disease (25), hn-frontpage (25).
Gut Score and Skill are Brier skill scores against the base rate, times 100, averaged over the headline packs: poker-equity, base-rates and hn-frontpage. heart-disease is scored below but kept out of the headline, because its records are public and a model may have memorised them.
Gut Score averages skill over seven deadlines from 0.25 s to 16 s. An answer that misses a deadline counts as the base rate, and no deadline scores above the skill of every answer.
The 95% intervals come from 1,000 paired bootstrap resamples of the items. "Ahead of next" is the share of resamples in which a contestant's Gut Score beats the next one down, and below 95% the two are not separated.

## Leaderboard

| Contestant | Gut Score | 95% interval | Ahead of next | Skill | 95% interval | p50 latency | p95 latency | Answered | Cost per 1,000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 59.0 | 56.1 to 62.5 | 100% | 65.1 | 62.5 to 68.1 | 301 ms | 463 ms | 100/100 | $0.02 |
| `decide:typesafe-ai/jev` | 51.3 | 45.0 to 56.2 | 99% | 57.2 | 50.5 to 61.9 | 264 ms | 386 ms | 100/100 | $0.02 |
| `decide:microsoft/microsoft-decision-1` | 37.5 | 26.4 to 47.1 | 81% | 46.8 | 34.0 to 58.7 | 299 ms | 766 ms | 100/100 | $0.0044 |
| `llm:anthropic/claude-opus-5.5` | 32.0 | 25.0 to 37.3 | 100% | 71.2 | 62.3 to 80.0 | 2.0 s | 5.3 s | 100/100 | $2.91 |
| `llm:anthropic/claude-opus-5.5@high` | 25.7 | 18.8 to 29.4 | 100% | 69.9 | 60.6 to 78.6 | 3.1 s | 8.3 s | 100/100 | $5.02 |
| `llm:openai/gpt-6.1-sol` | 12.4 | -11.4 to 16.4 | 90% | 66.9 | 42.3 to 80.6 | 5.7 s | 39.4 s | 100/100 | $2.21 |
| `llm:google/gemini-3.8-flash` | 0.3 | -24.5 to 7.9 | n/a | 28.8 | 4.4 to 45.3 | 12.3 s | 57.6 s | 75/100 | $8.37 |

## Skill by deadline

Each column averages the headline packs with every answer slower than the deadline counted as the base rate.

| Contestant | 0.25 s | 0.5 s | 1 s | 2 s | 4 s | 8 s | 16 s | No deadline |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 24.3 | 63.3 | 65.1 | 65.1 | 65.1 | 65.1 | 65.1 | 65.1 |
| `decide:typesafe-ai/jev` | 17.2 | 55.9 | 57.2 | 57.2 | 57.2 | 57.2 | 57.2 | 57.2 |
| `decide:microsoft/microsoft-decision-1` | 0.0 | 28.6 | 46.8 | 46.8 | 46.8 | 46.8 | 46.8 | 46.8 |
| `llm:anthropic/claude-opus-5.5` | 0.0 | 0.0 | -0.1 | 26.2 | 58.0 | 68.9 | 71.2 | 71.2 |
| `llm:anthropic/claude-opus-5.5@high` | 0.0 | 0.0 | 0.0 | 7.2 | 44.1 | 58.6 | 69.9 | 69.9 |
| `llm:openai/gpt-6.1-sol` | 0.0 | 0.0 | 0.0 | 0.0 | 15.0 | 35.0 | 36.9 | 66.9 |
| `llm:google/gemini-3.8-flash` | -7.2 | -7.2 | -7.2 | -7.2 | -7.2 | 11.4 | 26.2 | 28.8 |

## Skill by pack

| Contestant | poker-equity | base-rates | heart-disease (outside headline) | hn-frontpage |
| --- | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 95.8 | 100.0 | 6.4 | -0.6 |
| `decide:typesafe-ai/jev` | 80.2 | 83.7 | 43.0 | 7.8 |
| `decide:microsoft/microsoft-decision-1` | 69.2 | 63.2 | 54.9 | 8.0 |
| `llm:anthropic/claude-opus-5.5` | 98.8 | 100.0 | 68.5 | 14.7 |
| `llm:anthropic/claude-opus-5.5@high` | 98.6 | 100.0 | 73.1 | 11.0 |
| `llm:openai/gpt-6.1-sol` | 99.7 | 100.0 | 68.8 | 1.0 |
| `llm:google/gemini-3.8-flash` | 7.7 | 100.0 | 79.3 | -21.5 |

## poker-equity

Each item asks about heads-up hold'em equity with both players all in before the flop. The truth is an exact probability, and the base rate is 0.501 over 25 items.

| Contestant | Skill | Gut Score | Log loss | ECE | Accuracy | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 95.8 | 88.3 | 0.463 | 0.030 | 96.0 | 305 ms | 25/25 |
| `decide:typesafe-ai/jev` | 80.2 | 70.6 | 0.509 | 0.083 | 84.0 | 282 ms | 25/25 |
| `decide:microsoft/microsoft-decision-1` | 69.2 | 52.3 | 0.594 | 0.141 | 88.0 | 346 ms | 25/25 |
| `llm:anthropic/claude-opus-5.5` | 98.8 | 42.5 | 0.456 | 0.025 | 100.0 | 2.0 s | 25/25 |
| `llm:anthropic/claude-opus-5.5@high` | 98.6 | 27.4 | 0.455 | 0.021 | 100.0 | 4.5 s | 25/25 |
| `llm:openai/gpt-6.1-sol` | 99.7 | 2.0 | 0.452 | 0.010 | 100.0 | 27.7 s | 25/25 |
| `llm:google/gemini-3.8-flash` | 7.7 | 0.0 | 0.675 | 0.026 | 52.0 | 24.4 s | 2/25 |

## base-rates

Each item asks about the chance of a condition after a positive screening test. The truth is an exact probability, and the base rate is 0.513 over 25 items.

| Contestant | Skill | Gut Score | Log loss | ECE | Accuracy | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 100.0 | 89.6 | 0.485 | 0.002 | 100.0 | 309 ms | 25/25 |
| `decide:typesafe-ai/jev` | 83.7 | 76.6 | 0.527 | 0.073 | 92.0 | 257 ms | 25/25 |
| `decide:microsoft/microsoft-decision-1` | 63.2 | 53.9 | 0.600 | 0.126 | 88.0 | 287 ms | 25/25 |
| `llm:anthropic/claude-opus-5.5` | 100.0 | 46.5 | 0.485 | 0.000 | 100.0 | 2.4 s | 25/25 |
| `llm:anthropic/claude-opus-5.5@high` | 100.0 | 44.9 | 0.485 | 0.000 | 100.0 | 2.6 s | 25/25 |
| `llm:openai/gpt-6.1-sol` | 100.0 | 35.8 | 0.485 | 0.000 | 100.0 | 4.3 s | 25/25 |
| `llm:google/gemini-3.8-flash` | 100.0 | 22.2 | 0.485 | 0.000 | 100.0 | 8.2 s | 25/25 |

## heart-disease

Each item asks about coronary artery disease after a cardiology work-up. The truth is the observed outcome, and the base rate is 0.600 over 25 items. This pack is outside the headline score.

| Contestant | Skill | Gut Score | Log loss | ECE | Accuracy | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | 6.4 | 5.2 | 0.639 | 0.279 | 64.0 | 281 ms | 25/25 |
| `decide:typesafe-ai/jev` | 43.0 | 38.9 | 0.436 | 0.218 | 88.0 | 264 ms | 25/25 |
| `decide:microsoft/microsoft-decision-1` | 54.9 | 44.7 | 0.370 | 0.232 | 92.0 | 299 ms | 25/25 |
| `llm:anthropic/claude-opus-5.5` | 68.5 | 34.8 | 0.275 | 0.180 | 88.0 | 1.9 s | 25/25 |
| `llm:anthropic/claude-opus-5.5@high` | 73.1 | 32.4 | 0.251 | 0.154 | 92.0 | 2.9 s | 25/25 |
| `llm:openai/gpt-6.1-sol` | 68.8 | 19.9 | 0.267 | 0.158 | 92.0 | 6.1 s | 25/25 |
| `llm:google/gemini-3.8-flash` | 79.3 | 7.7 | 0.200 | 0.113 | 96.0 | 15.6 s | 24/25 |

## hn-frontpage

Each item asks about whether a Hacker News story reaches 100 points. The truth is the observed outcome, and the base rate is 0.280 over 25 items.

| Contestant | Skill | Gut Score | Log loss | ECE | Accuracy | p50 latency | Answered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `decide:openai/gpt-6-luna-decisions` | -0.6 | -0.8 | 0.595 | 0.054 | 72.0 | 299 ms | 25/25 |
| `decide:typesafe-ai/jev` | 7.8 | 6.8 | 0.557 | 0.071 | 72.0 | 261 ms | 25/25 |
| `decide:microsoft/microsoft-decision-1` | 8.0 | 6.3 | 0.552 | 0.120 | 76.0 | 295 ms | 25/25 |
| `llm:anthropic/claude-opus-5.5` | 14.7 | 7.1 | 0.521 | 0.035 | 76.0 | 1.8 s | 25/25 |
| `llm:anthropic/claude-opus-5.5@high` | 11.0 | 4.7 | 0.537 | 0.199 | 76.0 | 2.9 s | 25/25 |
| `llm:openai/gpt-6.1-sol` | 1.0 | -0.5 | 0.580 | 0.190 | 68.0 | 4.9 s | 25/25 |
| `llm:google/gemini-3.8-flash` | -21.5 | -21.5 | 0.740 | 0.148 | 64.0 | 20.3 s | 24/25 |

## Run notes

AI Gateway took a median of 56 ms to answer a request that does no model work, measured 2 times at the start of a session. Every latency above includes about that much network and Gateway time.

| Contestant | Reasoning asked | Reasoning tokens per answer | Warnings |
| --- | ---: | ---: | ---: |
| `llm:anthropic/claude-opus-5.5` | none | 36.1 | none |
| `llm:anthropic/claude-opus-5.5@high` | high | 141.3 | none |
| `llm:openai/gpt-6.1-sol` | none | 162.1 | none |
| `llm:google/gemini-3.8-flash` | none | 2169.4 | none |

`llm:anthropic/claude-opus-5.5` was asked to answer with reasoning off but used 36 reasoning tokens per answer, so its latency and cost include reasoning.

`llm:openai/gpt-6.1-sol` was asked to answer with reasoning off but used 162 reasoning tokens per answer, so its latency and cost include reasoning.

`llm:google/gemini-3.8-flash` was asked to answer with reasoning off but used 2169 reasoning tokens per answer, so its latency and cost include reasoning.
