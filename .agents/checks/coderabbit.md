---
name: coderabbit
description: Runs CodeRabbit CLI for AST-aware code quality review
severity-default: medium
tools: [Bash, Read]
---

Run CodeRabbit CLI review on the current changes.

## Steps

1. Check if CodeRabbit CLI is installed:
   ```bash
   which coderabbit
   ```
   If not installed, skip this check and report:
   "Skipped: CodeRabbit CLI not installed. Install and authenticate:
   ```
   npm install -g coderabbit
   coderabbit auth login
   ```
   See https://docs.coderabbit.ai/guides/cli for setup."

2. Run review:
   ```bash
   coderabbit --prompt-only --type uncommitted
   ```
   If there are committed but unpushed changes, use `--type committed` instead.

3. Parse CodeRabbit's output. Each finding should include:
   - File path and line number
   - Severity mapped from CodeRabbit's own levels
   - Category (logic, security, performance, style, test, architecture, dx)
   - Description and suggested fix

## Rate Limiting

CodeRabbit Pro allows 8 reviews/hour. If the rate limit is hit, skip and note it.

## Error Handling

- Auth expired: skip and report "CodeRabbit auth expired, run: coderabbit auth login"
- CLI timeout (>120s): skip and note
- Parse error: return raw output with a warning
