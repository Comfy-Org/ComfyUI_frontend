# QA Pipeline Model Selection

## Current Configuration

| Script                | Role                                   | Model                    | Why                                                                                                 |
| --------------------- | -------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| `qa-analyze-pr.ts`    | PR/issue analysis, QA guide generation | `gemini-3.1-pro-preview` | Needs deep reasoning over PR diffs, screenshots, and issue threads                                  |
| `qa-record.ts`        | Playwright step generation             | `gemini-3.1-pro-preview` | Step quality is critical — must understand ComfyUI's canvas UI and produce precise action sequences |
| `qa-video-review.ts`  | Video comparison review                | `gemini-3-flash-preview` | Video analysis with structured output; flash is sufficient and faster                               |
| `qa-generate-test.ts` | Regression test generation             | `gemini-3-flash-preview` | Code generation from QA reports; flash handles this well                                            |

## Model Comparison

### Gemini 3.1 Pro vs GPT-5.4

|                   | Gemini 3.1 Pro Preview | GPT-5.4           |
| ----------------- | ---------------------- | ----------------- |
| Context window    | 1M tokens              | 1M tokens         |
| Max output        | 65K tokens             | 128K tokens       |
| Video input       | Yes                    | No                |
| Image input       | Yes                    | Yes               |
| Audio input       | Yes                    | No                |
| Pricing (input)   | $2/1M tokens           | $2.50/1M tokens   |
| Pricing (output)  | $12/1M tokens          | $15/1M tokens     |
| Function calling  | Yes                    | Yes               |
| Code execution    | Yes                    | Yes (interpreter) |
| Structured output | Yes                    | Yes               |

**Why Gemini over GPT for QA:**

- Native video understanding (can review recordings directly)
- Lower cost at comparable quality
- Native multimodal input (screenshots, videos, audio from issue threads)
- Better price/performance for high-volume CI usage

### Gemini 3 Flash vs GPT-5.4 Mini

|                  | Gemini 3 Flash Preview | GPT-5.4 Mini    |
| ---------------- | ---------------------- | --------------- |
| Context window   | 1M tokens              | 1M tokens       |
| Pricing (input)  | $0.50/1M tokens        | $0.40/1M tokens |
| Pricing (output) | $3/1M tokens           | $1.60/1M tokens |
| Video input      | Yes                    | No              |

**Why Gemini Flash for video review:**

- Video input support is required — GPT models cannot process video files
- Good enough quality for structured comparison reports

## Upgrade History

| Date       | Change                                                           | Reason                                                                     |
| ---------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2026-03-24 | `gemini-2.5-flash` → `gemini-3.1-pro-preview` (record)           | Shallow step generation; pro model needed for complex ComfyUI interactions |
| 2026-03-24 | `gemini-2.5-pro` → `gemini-3.1-pro-preview` (analyze)            | Keep analysis on latest pro                                                |
| 2026-03-24 | `gemini-2.5-flash` → `gemini-3-flash-preview` (review, test-gen) | Latest flash for cost-efficient tasks                                      |

## Override

All scripts accept `--model <name>` to override the default. Pass any Gemini model ID.
