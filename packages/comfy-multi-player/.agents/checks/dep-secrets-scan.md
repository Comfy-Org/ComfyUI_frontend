# Dependency and secrets scan

Detect known CVEs in dependencies and leaked secrets. Applies to any change; especially package metadata and scripts.

## Steps

1. Probe tools: `npm --version`, `gitleaks version`. If neither is available, skip and report the install hints (`npm i -g npm`, gitleaks: https://github.com/gitleaks/gitleaks#installing). If only one is available, run it and note the other was skipped.
2. **Dependency audit** (npm):
   ```bash
   npm audit --json; echo "npm audit exit: $?"
   ```
   Do not suppress stderr or discard the exit status: `npm audit` exits non-zero when it finds advisories, but a non-zero exit with no parseable JSON means the tool itself failed — report that as an error, not a clean result. Map severity `critical`→critical, `high`→major, `moderate`→minor, `low`→nitpick. Report package, version, advisory title, CVE, and patched version.
3. **Secrets** (gitleaks):
   ```bash
   gitleaks detect --no-banner --report-format json --report-path /tmp/gitleaks.json --source .; echo "gitleaks exit: $?"
   ```
   `gitleaks` exits `1` when it finds secrets and `2` on execution error — never collapse these to a pass. If the run errors or the report cannot be parsed, report it as an indeterminate/failed scan, not "no issues found". All secret findings are critical. Report file/line, rule, a redacted match, and advise removal plus credential rotation.

## Repo-specific emphasis

- The production dependency set must remain **`yjs` only** (KA-3/FC-3). Any audit finding that arrives via a *new* production dependency is also a purity violation, not just a CVE — flag both. Dev-only advisories (Stryker, Vitest, TypeScript, fast-check) are lower priority but still reported.
- This is a pure library with no server, no credentials, and no network; any secret, token, connection string, or key in the tree is unexpected by construction and is critical.

## Error handling

- If one tool fails, continue with the other. If JSON parsing fails, include raw output with a warning. If both are clean, report "No issues found."
