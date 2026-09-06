# Import-graph review

Validate import boundaries and detect circular dependencies. This reinforces purity (KA-3, FC-3) at the module-graph level and complements `scripts/check-purity.mjs`, which reasons about the installed dependency tree and a bare-Node import of `dist/` and therefore cannot see which source module reached for what.

## Steps

1. `npm ci` (dependency-cruiser is a devDependency; its rules live in `.dependency-cruiser.cjs`).
2. Run the gate:
   ```bash
   npm run check:imports
   ```
3. Read the exit code. **`0` is the only green.**
   - `0` — clean. The line reports how many modules and dependencies were cruised; a run that analyzed nothing cannot reach this code.
   - `1` — rule violations, listed with rule name and the offending edge or cycle.
   - `2` — INCONCLUSIVE. Either dependency-cruiser is missing or the run cruised fewer modules than the floor. Report this as unresolved, never as "no issues found".
4. Map violations to findings: `no-circular` → major, category architecture; other `error` rules → major; `warn` → minor; `info` → nitpick.
5. For anything the rules cannot express, read the diff against the repo-specific rules below and report by hand.

## Do not run it the old way

The previous version of this profile documented `npx --yes dependency-cruiser --no-config --output-type json --do-not-follow "node_modules" --include-only "^src" src`. In this repo that invocation printed `✔ no dependency violations found (0 modules, 0 dependencies cruised)` and exited `0` — a **vacuous green**: a reviewer agent reported "no issues found" having analyzed nothing. Two independent causes, both worth remembering because either alone is enough to hollow out a check:

- **`npx --yes` installs dependency-cruiser outside the project.** It enables a language extension only when that transpiler resolves from its own install location, so `typescript` was not found, `.ts` was a DISABLED extension (`npx depcruise --info` shows this), and a directory scan of a 100%-TypeScript `src/` matched zero files. Naming a file explicitly (`… src/index.ts`) still worked, which is why the flaw survived review.
- **`--include-only "^src"` deletes every external module from the graph.** With it, `node_modules/**` and Node builtins are not in the graph at all, so a purity rule of the form "from `src` to a non-`yjs` package" has nothing to match and can never fire — even with `.ts` working. Use `doNotFollow` instead: external modules stay as edges, their own dependencies simply are not traversed.

If you must invoke the tool directly, use the project-local binary (`npx depcruise --output-type json src`) so it resolves this project's `typescript`, and check `summary.totalCruised` before believing `summary.violations`.

## Repo-specific rules

Encoded in `.dependency-cruiser.cjs` and enforced by the gate:

- `no-circular` — circular imports among the pure modules are a design smell that makes the package harder to tree-shake and reason about; extract the shared type or helper.
- `src-runtime-dep-is-yjs-only` — `src/**` may import no npm package other than `yjs`, checked per source module. This is the module-graph layer of the yjs-only assertion; `scripts/check-purity.mjs` already asserts it positively at the package level (`runtime dependency roots exactly {yjs} (declared and resolved production graph)`), so the two are complementary, not a gap and its fix. Note the rule matches **direct** edges out of `^src` only: a chain `src/x.ts → tools/helper.js → some-package` is not caught, because the offending edge's `from` is not under `src`.
- `src-no-node-builtins` — a Node builtin in the op layer makes it server-only and unrunnable in a browser or at a peer (FC-3).
- `no-unresolvable` — an unresolvable import is a typo or a module that exists in only one of the two runtimes.

Still review by hand, because no rule covers them:

- A DOM, framework, or LiteGraph global used without an import (`document`, `window`, `LGraphNode`) is a blocking FC-3 finding.
- Test-only imports (`test/**` reaching into `src`) are expected; do not flag them. The gate scopes itself to `src` by argument, so they do not appear.

## Error handling

- If `npm run check:imports` exits `2`, report: "Import-graph check INCONCLUSIVE — <reason>". Do not substitute a hand-rolled `npx --yes` invocation to get a green.
- If more than 20 violations, the gate prints the first 20 and the total; report the same.
- If the gate exits `0`, report "No issues found (<n> modules, <m> dependencies cruised)" — always quote the counts, so a future vacuous run is visible in the review itself.
- The module floor bounds vacuity, not rule adequacy. A run can clear it and still be blind: with `includeOnly: "^src"` restored, a planted `node:fs` import in `src/doc.ts` cruises 9 modules / 22 dependencies and exits `0`, because the filter removed the external modules the purity rules target. A healthy run is 10 modules / 27 dependencies, so the tell is the **dependency** count, which the floor does not check; raising the floor does not close this, since the filtered run loses externals rather than source modules. If you change `.dependency-cruiser.cjs`, re-prove each rule by planting one violation **per rule** and confirming that rule is the one named in the output — `mutant -> the named rule`, never `mutant -> red`.

<!--
Staleness anchors for the rule names and exit codes this profile restates.
`scripts/check-profile-claims.mjs` verifies each substring below is still present
verbatim in the cited file, so renaming a rule or dropping an exit path fails CI
rather than silently leaving this prose describing a gate that no longer exists.
-->
<!-- claim: name: "no-circular" :: .dependency-cruiser.cjs -->
<!-- claim: name: "src-runtime-dep-is-yjs-only" :: .dependency-cruiser.cjs -->
<!-- claim: name: "src-no-node-builtins" :: .dependency-cruiser.cjs -->
<!-- claim: name: "no-unresolvable" :: .dependency-cruiser.cjs -->
<!-- claim: doNotFollow: { path: "node_modules" } :: .dependency-cruiser.cjs -->
<!-- claim: if (totalCruised < MIN_MODULES) :: scripts/check-import-graph.mjs -->
<!-- claim: import-graph check INCONCLUSIVE :: scripts/check-import-graph.mjs -->
<!-- claim: import-graph check FAILED :: scripts/check-import-graph.mjs -->
<!-- claim: import-graph check PASSED :: scripts/check-import-graph.mjs -->

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
