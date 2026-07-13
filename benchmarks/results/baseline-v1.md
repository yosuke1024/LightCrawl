# LightCrawl Benchmark Report

Generated at: 2026-07-13T07:29:00.166Z

## 1. Executive Summary

LightCrawl token efficiency benchmark results.

* **Offline Benchmark Fixtures:** 12
* **Token Reduction vs Body Text:** -13.89%
* **Fact Retention Rate:** 91.67%

## 2. Methodology

The benchmark consists of an offline phase measuring token efficiency and an agent phase measuring development velocity.
Tokenizer used: js-tiktoken (o200k_base).

## 3. Environment Information

* **Node.js:** v25.5.0
* **OS:** darwin
* **Arch:** arm64
* **Tokenizer:** js-tiktoken (o200k_base)

## 4. Offline Token Efficiency & Information Retention

| ID | Reduction | Retention | Raw Tokens | Body Tokens | Article Tokens |
|---|---|---|---|---|---|
| tech-doc-en-01 | N/A | 50.00% | 82 | 22 | 25 |
| tech-doc-ja-01 | N/A | 50.00% | 109 | 28 | 45 |
| blog-en-01 | -17.65% | 100.00% | 44 | 17 | 20 |
| blog-ja-01 | -8.82% | 100.00% | 73 | 34 | 37 |
| news-en-01 | 9.52% | 100.00% | 59 | 21 | 19 |
| news-ja-01 | -7.14% | 100.00% | 51 | 28 | 30 |
| landing-en-01 | -4.17% | 100.00% | 62 | 24 | 25 |
| landing-ja-01 | -38.46% | 100.00% | 63 | 26 | 36 |
| ad-heavy-en-01 | 5.56% | 100.00% | 73 | 18 | 17 |
| table-en-01 | -77.78% | 100.00% | 72 | 9 | 16 |
| short-en-01 | 0.00% | 100.00% | 18 | 3 | 3 |
| hard-readability-ja-01 | 0.00% | 100.00% | 40 | 12 | 12 |

## 5. Agent Development Benchmark

* **Tasks Executed:** 4

### Condition: lightcrawl_article
* **Success Rate:** 100.00% (4/4)
* **Median Time-to-Green (ms):** 11690
* **Median Total Tokens:** 604

### Condition: body_text
* **Success Rate:** 100.00% (4/4)
* **Median Time-to-Green (ms):** 15946
* **Median Total Tokens:** 768

## 6. Reproduction Instructions

Run `npm run benchmark:offline` to generate offline results.
Run `npm run benchmark:agent` with `GEMINI_API_KEY` to run the agent benchmark.
