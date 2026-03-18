---
name: semgrep-sast
description: Runs Semgrep SAST with auto-configured rules for JS/TS/Vue
severity-default: high
tools: [Bash, Read]
---

Run Semgrep static analysis on changed files to detect security vulnerabilities, dangerous patterns, and framework-specific issues.

## Steps

1. Check if semgrep is installed:

   ```bash
   semgrep --version
   ```

   If not installed, skip this check and report: "Skipped: semgrep not installed. Install with: `pip3 install semgrep`"

2. Identify changed files (`.ts`, `.js`, `.vue`) from the diff.
   If none are found, skip and report: "Skipped: no changed JS/TS/Vue files."

3. Run semgrep against changed files:

   ```bash
   semgrep --config=auto --json --quiet <changed_files>
   ```

4. Parse the JSON output (`.results[]` array). For each finding, map severity:
   - Semgrep `ERROR` → `critical`
   - Semgrep `WARNING` → `major`
   - Semgrep `INFO` → `minor`

5. Report each finding with:
   - The semgrep rule ID (`check_id`)
   - File path and line number (`path`, `start.line`)
   - The message from `extra.message`
   - A fix suggestion from `extra.fix` if available, otherwise general remediation advice

## What Semgrep Catches

With `--config=auto`, Semgrep loads community-maintained rules for:

- **Security vulnerabilities:** injection, XSS, SSRF, path traversal, open redirect
- **Dangerous patterns:** eval(), innerHTML, dangerouslySetInnerHTML, exec()
- **Crypto issues:** weak hashing, hardcoded secrets, insecure random
- **Best practices:** missing security headers, unsafe deserialization
- **Framework-specific:** Express, React, Vue security patterns

## Error Handling

- If semgrep config download fails, skip and report the error.
- If semgrep fails to parse a specific file, skip that file and continue with others.
- If semgrep produces no findings, report "No issues found."
