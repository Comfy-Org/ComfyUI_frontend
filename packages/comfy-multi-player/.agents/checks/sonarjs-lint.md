# SonarJS static analysis

Run `eslint-plugin-sonarjs` on changed files for SonarQube-grade bug and code-smell detection without a server.

## Steps

1. Identify changed `.ts`/`.js` files from the diff. This repo's `src/**` is all TypeScript, so the config must parse `.ts` (see `eslint.strict.config.js`, which sets `@typescript-eslint/parser`).
2. Use the colocated strict config `.agents/checks/eslint.strict.config.js`. If it is missing or fails to load, skip and report: "Skipped: `.agents/checks/eslint.strict.config.js` missing; SonarJS rules require explicit config."
3. Install the tools transiently so the config's bare `import` statements resolve. Do NOT use `npx --package … eslint`: a config file's imports resolve relative to the repo, not the npx cache, so that form fails with `ERR_MODULE_NOT_FOUND`. `--no-save` keeps `package.json` (the yjs-only production dep set) untouched:
   ```bash
   npm i --no-save eslint eslint-plugin-sonarjs @typescript-eslint/parser
   ```
   If install fails, skip and report: "Skipped: could not install eslint/sonarjs." Restore `package-lock.json` afterward if the install touched it (`git checkout -- package-lock.json`).
4. Run (do not suppress stderr or discard the exit status — a failed lint run must not look like a clean pass):
   ```bash
   npx eslint --no-config-lookup --config .agents/checks/eslint.strict.config.js \
     --format json <changed_files>; echo "eslint exit: $?"
   ```
   ESLint exits `1` when it reports problems and `2` on a config/execution error. Treat exit `2`, a parse error, or empty/no output as **indeterminate** (report the failure), never as "no issues found".
5. Parse the JSON. Map eslint `severity 2`→major, `severity 1`→minor. Categorize `sonarjs/no-*`→logic, `*cognitive-complexity*`→dx, others→style.
6. Report rule ID, `path:line`, message, and a fix suggestion.

## What it catches

The exact rule set is the plugin's `recommended` config (currently eslint-plugin-sonarjs v4) plus a stricter cognitive-complexity threshold; specific rule IDs vary by plugin version. Broadly:

- Bugs: duplicated/identical branches and conditions, element overwrite, identical expressions, one-iteration loops, unused/empty return values, collection-size mischecks.
- Smells: cognitive complexity (threshold 15), duplicate strings, redundant booleans, nested conditionals/template literals, redundant type aliases.

## Repo-specific emphasis

- The applier and stamp comparator are the highest-value targets: a `no-identical-conditions`, `no-identical-expressions`, or `no-element-overwrite` hit there can indicate a real ordering/LWW or autogrow bug, not merely a smell. Escalate such findings and cross-check the affected KA-*/FC-* invariant.

## Error handling

- Skip un-parseable files and continue. If the plugin/parser fails to install or ESLint exits `2`, report an indeterminate/failed run — do not report "No issues found". Report "No issues found" only when ESLint ran successfully (exit `0`) and produced an empty findings array.
