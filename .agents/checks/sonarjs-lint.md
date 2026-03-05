---
name: sonarjs-lint
description: Runs SonarQube-grade static analysis using eslint-plugin-sonarjs
severity-default: high
tools: [Bash, Read]
---

Run eslint-plugin-sonarjs analysis on changed files to detect bugs, code smells, and security patterns without needing a SonarQube server.

## Steps

1. Check if eslint is available:

   ```bash
   pnpm dlx eslint --version
   ```

   If pnpm dlx or eslint is unavailable, skip this check and report: "Skipped: eslint not available. Ensure Node.js and pnpm dlx are installed."

2. Identify changed files (`.ts`, `.js`, `.vue`) from the diff.

3. Determine eslint config to use. This check uses a **strict sonarjs-specific config** (not the project's own eslint config, which is less strict):
   - Look for the colocated strict config at `.agents/checks/eslint.strict.config.js`
   - If found, run with `--config .agents/checks/eslint.strict.config.js`
   - **Fallback:** if the strict config cannot be found or fails to load, skip this check and report: "Skipped: .agents/checks/eslint.strict.config.js missing; SonarJS rules require explicit config."

4. Run eslint against changed files:

   ```bash
   # Use the strict config
   pnpm dlx --yes --package eslint-plugin-sonarjs eslint --no-config-lookup --config .agents/checks/eslint.strict.config.js --format json <changed_files> 2>/dev/null || true
   ```

5. Parse the JSON array of file results. For each eslint message, map severity:
   - `severity 2` (error) → `major`
   - `severity 1` (warning) → `minor`

6. Categorize findings by rule ID:
   - Rule IDs starting with `sonarjs/no-` → category: `logic`
   - Rule IDs containing `cognitive-complexity` → category: `dx`
   - Other sonarjs rules → category: `style`

7. Report each finding with:
   - The rule ID
   - File path and line number
   - The message from eslint
   - A fix suggestion based on the rule

## What This Catches

- **Bug detection:** duplicated branches, element overwrite, identical conditions/expressions, one-iteration loops, empty return values
- **Code smells:** cognitive complexity (threshold: 15), duplicate strings, redundant booleans, small switches
- **Security patterns:** via sonarjs recommended ruleset

## Error Handling

- If eslint fails to parse a Vue file, skip that file and continue with others.
- If the plugin fails to install, skip and report the error.
- If eslint produces no output or errors, report "No issues found."
