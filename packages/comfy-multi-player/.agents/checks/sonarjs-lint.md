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
4. Run (do not suppress stderr or discard the exit status — a failed lint run must not look like a clean pass). `--no-warn-ignored` is load-bearing, not cosmetic: see the non-vacuousness note below.
   ```bash
   npx eslint --no-config-lookup --config .agents/checks/eslint.strict.config.js \
     --no-warn-ignored --format json <changed_files>; echo "eslint exit: $?"
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
- Non-vacuousness: an empty findings array also results from linting nothing. Compare the array's length against the number of files you passed; if it is shorter, the missing files were never linted and the run is INCONCLUSIVE for them. Report "No issues found (<n> files linted)" with the count.
  - That comparison only works with `--no-warn-ignored`. **Without the flag ESLint emits an entry for a file it did NOT lint** — `messages: [{ ruleId: null, severity: 1, message: "File ignored because of a matching ignore pattern" }]`, or `"File ignored because no matching configuration was supplied."` for an extension the config does not match — so the lengths agree and the check passes on exactly the case it exists to catch. Verified on ESLint v10.8.1: passing `src/applier.ts src/doc.ts dist/index.js` returns 3 entries without the flag and 1 with it. If you must run without it, count an entry as linted only when it carries no `ruleId: null` "File ignored" message.
  - A run whose linted count is zero is INCONCLUSIVE even at exit `0`.

<!-- Staleness anchor: the run command this profile documents must stay the one the config expects. -->
<!-- claim: npx eslint --no-config-lookup --config .agents/checks/eslint.strict.config.js :: .agents/checks/eslint.strict.config.js -->

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
