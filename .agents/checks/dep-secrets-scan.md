---
name: dep-secrets-scan
description: Runs dependency vulnerability audit and secrets detection
severity-default: critical
tools: [Bash, Read]
---

Run dependency audit and secrets scan to detect known CVEs in dependencies and leaked secrets in code.

## Steps

1. Check which tools are available:

   ```bash
   pnpm --version
   gitleaks version
   ```

   - If **neither** is installed, skip this check and report: "Skipped: neither pnpm nor gitleaks installed. Install pnpm: `npm i -g pnpm`. Install gitleaks: `brew install gitleaks` or see https://github.com/gitleaks/gitleaks#installing"
   - If only one is available, run that one and note the other was skipped.

2. **Dependency audit** (if pnpm is available):

   ```bash
   pnpm audit --json 2>/dev/null || true
   ```

   Parse the JSON output. Map advisory severity:
   - `critical` advisory → `critical`
   - `high` advisory → `major`
   - `moderate` advisory → `minor`
   - `low` advisory → `nitpick`

   Report each finding with: package name, version, advisory title, CVE, and suggested patched version.

3. **Secrets detection** (if gitleaks is available):

   ```bash
   gitleaks detect --no-banner --report-format json --source . 2>/dev/null || true
   ```

   Parse the JSON output. All secret findings are `critical` severity.

   Report each finding with: file and line, rule description, and a redacted match. Always suggest removing the secret and rotating credentials.

## What This Catches

### Dependency Audit

- Known CVEs in direct and transitive dependencies
- Vulnerable packages from the npm advisory database

### Secrets Detection

- API keys and tokens in code
- AWS credentials, GCP service account keys
- Database connection strings with passwords
- Private keys and certificates
- Generic high-entropy secrets

## Error Handling

- If pnpm audit fails, log the error and continue with gitleaks.
- If gitleaks fails, log the error and continue with audit results.
- If JSON parsing fails for either tool, include raw output with a warning.
- If both tools produce no findings, report "No issues found."
