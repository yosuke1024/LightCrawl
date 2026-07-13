# LightCrawl Benchmark Report (Phase 1C & 2B)

Generated at: 2026-07-13T08:44:26.770Z
Node Version: v25.5.0
Tokenizer: js-tiktoken@o200k_base

## Offline Token Efficiency - SYNTHETIC Dataset

* **Fixtures Evaluated:** 25

| Condition | Total Tokens | Fact Ret% | Code Ret% | Heading Ret% | Table Ret% | Link Ret% | Token Reduction |
|---|---|---|---|---|---|---|---|
| raw_html | 58317 | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | -11.29% |
| body_text | 52402 | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| lightcrawl_full | 51854 | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 1.05% |
| lightcrawl_article | 50513 | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 3.60% |
| lightcrawl_auto_candidate | 50513 | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 3.60% |

## Offline Token Efficiency - REAL_WORLD Dataset

* **Fixtures Evaluated:** 20

| Condition | Total Tokens | Fact Ret% | Code Ret% | Heading Ret% | Table Ret% | Link Ret% | Token Reduction |
|---|---|---|---|---|---|---|---|
| raw_html | 92602 | 100.00% | 62.96% | 100.00% | 100.00% | 100.00% | -248.04% |
| body_text | 26607 | 100.00% | 100.00% | 96.67% | 100.00% | 100.00% | 0.00% |
| lightcrawl_full | 64744 | 100.00% | 100.00% | 96.67% | 100.00% | 100.00% | -143.33% |
| lightcrawl_article | 62125 | 100.00% | 100.00% | 95.00% | 100.00% | 100.00% | -133.49% |
| lightcrawl_auto_candidate | 62125 | 100.00% | 100.00% | 95.00% | 100.00% | 100.00% | -133.49% |

## Offline Token Efficiency - COMBINED Dataset

* **Fixtures Evaluated:** 45

| Condition | Total Tokens | Fact Ret% | Code Ret% | Heading Ret% | Table Ret% | Link Ret% | Token Reduction |
|---|---|---|---|---|---|---|---|
| raw_html | 150919 | 100.00% | 74.36% | 100.00% | 100.00% | 100.00% | -91.01% |
| body_text | 79009 | 100.00% | 100.00% | 97.65% | 100.00% | 100.00% | 0.00% |
| lightcrawl_full | 116598 | 100.00% | 100.00% | 97.65% | 100.00% | 100.00% | -47.58% |
| lightcrawl_article | 112638 | 100.00% | 100.00% | 96.47% | 100.00% | 100.00% | -42.56% |
| lightcrawl_auto_candidate | 112638 | 100.00% | 100.00% | 96.47% | 100.00% | 100.00% | -42.56% |

### Offline Token Claim
❌ **insufficient_evidence**: Metrics not met: Fact=1, Code=1, Table=1, Reduction=-1.3349118652986056

