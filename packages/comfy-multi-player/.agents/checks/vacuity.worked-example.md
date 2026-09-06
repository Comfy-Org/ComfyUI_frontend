# Worked example: applying `vacuity.md` to a known-vacuous check

Fixture for [`vacuity.md`](vacuity.md). It exists because a profile that only *describes* vacuity is exactly the artifact class it warns about (V7, assertive documentation): a reviewer can write "vacuity check: PASS" without anything having gone red. So the profile carries a run of itself.

The subject is the `import-graph` check, chosen because both its vacuous and its remediated states are reachable from this tree: the vacuous version is what `.agents/checks/import-graph.md` documented before PR #52, and the remediated version is [`../../scripts/check-import-graph.mjs`](../../scripts/check-import-graph.mjs) / `npm run check:imports`.

**Provenance.** States 1 to 4 first run on `828dc82` (`fix/import-graph-check-vacuous-green`) on 2026-08-20; all five states re-run and re-verified on `76d0180` (`docs/vacuity-profile`) on 2026-08-21, Node v25.9.0, dependency-cruiser 17.4.3, after `npm ci`. All output below is pasted verbatim from that run; nothing is reconstructed.

**P0.** *This check goes red when a module under `src/` imports anything other than `yjs` — observed as `import-graph check FAILED: … error src-no-node-builtins: src/doc.ts → fs`, exit `1`.*

## The mutant

One line, prepended to `src/doc.ts`. A Node builtin in the op layer makes the package server-only and unrunnable at a peer — the `src-no-node-builtins` rule exists to make that fail (KA-3, FC-3).

```ts
import { readFileSync } from "node:fs";
void readFileSync;
```

## The five states

States 1 to 4 are band A: **can this check fail?** State 5 is band E: **can it fail for the property you are claiming?**

| # | State | Command | Work count | Verdict | Exit |
| --- | --- | --- | --- | --- | --- |
| 1 | clean tree | `npm run check:imports` | 9 modules / 23 deps | PASSED | `0` |
| 2 | mutant planted, remediated gate | `npm run check:imports` | 10 modules / 24 deps | FAILED `src-no-node-builtins` | `1` |
| 3 | **mutant still planted**, `includeOnly: "^src"` restored | `depcruise --config <variant> src` | **8 modules / 18 deps** | **no violations found** | **`0`** |
| 4 | clean tree, `typescript` unresolvable | `npm run check:imports` | 0 modules | INCONCLUSIVE | `2` |
| 5a | two mutants, all four rules live | `npm run check:imports` | 11 modules / 25 deps | FAILED, **2 rules named** | `1` |
| 5b | **same two mutants**, `src-runtime-dep-is-yjs-only` neutered | `depcruise --config <variant> src` | **11 modules / 25 deps** | FAILED, **1 rule named** | **`1`** |
| 5c | 5b's config, **one** mutant (the yjs-only one) | `depcruise --config <variant> src` | 10 modules / 24 deps | no violations found | `0` |

### 1. Baseline — the gate is green on a clean tree

```
$ npm run check:imports
import-graph check PASSED (9 modules, 23 dependencies cruised, 0 violations)
$ echo $?
0
```

A green with a stated work count. Without the count this line is indistinguishable from state 3 and state 4.

### 2. P1, mutant probe — the remediated gate goes red for the right reason

```
$ npm run check:imports
import-graph check FAILED: 1 violation(s) over 10 modules / 24 dependencies

  error src-no-node-builtins: src/doc.ts → fs

Rules live in .dependency-cruiser.cjs; see docs/INVARIANTS.md (KA-3, FC-3).
$ echo $?
1
```

Red, named rule, named edge. This is the artifact `vacuity.md` P1 demands; a claim of compliance would not have distinguished state 2 from state 3.

### 3. The one that matters — the same mutant, a vacuous variant, still green

The only difference from state 2 is one restored option in `.dependency-cruiser.cjs`, the one PR #52 removed and left a comment about:

```js
  options: {
    doNotFollow: { path: "node_modules" },
    includeOnly: "^src",          // <- the only change
```

The variant is deliberately **not** checked in — a vacuous config sitting next to a gate that reads `.dependency-cruiser.cjs` by default is a loaded gun. Regenerate it into a scratch path:

```bash
sed 's|doNotFollow: { path: "node_modules" },|&\n    includeOnly: "^src",|' \
  .dependency-cruiser.cjs > /tmp/dc-includeonly.cjs
```

`src/doc.ts` still imports `node:fs`. The rule set is byte-identical. The result:

```
$ ./node_modules/.bin/depcruise --config /tmp/dc-includeonly.cjs src

✔ no dependency violations found (8 modules, 18 dependencies cruised)

$ echo $?
0
```

```
$ ./node_modules/.bin/depcruise --config /tmp/dc-includeonly.cjs --output-type json src \
    | jq '.summary | {totalCruised, totalDependenciesCruised, violations: (.violations|length)}'
{
  "totalCruised": 8,
  "totalDependenciesCruised": 18,
  "violations": 0
}
```

`includeOnly: "^src"` removes every module outside `src` from the graph, so `fs` is not a node the rule can match against. `src-no-node-builtins` has nothing left to fire on and can never fire, no matter what is imported.

**This is the demonstration.** Read the three properties off it:

- **P2 alone would have missed it.** 8 modules cruised clears `MIN_MODULES = 8` in `check-import-graph.mjs`. The work-unit floor is satisfied. A reviewer who checked only the work count would have reported a pass.
- **Reading the rule would have missed it.** The rule is correct as written. The defect is one option in a different file, deleting the rule's matching set.
- **Only P1 caught it.** The gate is proven non-vacuous by the planted violation going red, and the variant is proven vacuous by the *same* planted violation staying green. That contrast is unavailable to anyone who did not plant the line.

And one thing states 1 to 4 do **not** show, which is why state 5 exists: what P1 proves here is that `src-no-node-builtins` can fire. Three other rules were never mutated, and the gate's exit code cannot distinguish them.

This is not a hypothetical reconstruction. It is the defect that bit the author of PR #52 mid-fix: their first repaired rule set passed a planted `node:fs` import for this exact reason, after the `.ts` resolution bug had already been fixed.

### 4. Reproducing the original failure mode — INCONCLUSIVE, not a pass

The pre-#52 profile documented `npx --yes dependency-cruiser …`, which installs the tool outside the project, where `typescript` does not resolve, so `.ts` is a disabled extension and a scan of a TypeScript-only `src/` matches zero files while exiting `0`. Simulated here by making `typescript` unresolvable from the gate:

```
$ mv node_modules/typescript /tmp/ts-hidden
$ npm run check:imports
import-graph check INCONCLUSIVE: cruised 0 modules, expected at least 8.
Nothing meaningful was analyzed, so 'no violations' proves nothing. Check that `.ts` is an enabled extension (`npx depcruise --info`); it requires typescript resolvable from dependency-cruiser's install location.
$ echo $?
2
```

The exit-code convention is what converts this from a green into a distinct outcome. Note that the *cause* is environment-dependent and can come and go silently: re-running the original `npx --yes … --include-only "^src" src` command on this machine today reports `no dependency violations found (8 modules, 16 dependencies cruised)` rather than the `0 modules` recorded in the source reports, because `npx` now resolves the project's `typescript`. The `includeOnly` defect in state 3 is deterministic and did not come and go. **Prefer the deterministic reproduction when writing a P1 row; an environment-dependent one can turn green without anyone touching the code.**

### 5. Band E — P1 goes honestly red and the guard is still unproven

States 1 to 4 answer band A's question. They do not answer band E's, and applying `vacuity.md` P10 to *this file* is what surfaced that. The question P10 asks is: **name the value the reviewer actually records, then find the smallest violation that leaves it unchanged.** The value a P1 row records for a gate is normally `mutant -> exit 1`. The `import-graph` gate has **four** rules and **one** exit code, so that value is a one-bit projection of a four-element rule set — the same relationship `project()` has to `encodeStateAsUpdate`.

Second mutant, prepended to `src/project.ts`. An npm dependency other than `yjs` in the op layer is the `src-runtime-dep-is-yjs-only` violation:

```ts
import fc from "fast-check";
void fc;
```

**5a. Both mutants, all four rules live.**

```
$ npm run check:imports
import-graph check FAILED: 2 violation(s) over 11 modules / 25 dependencies

  error src-no-node-builtins: src/doc.ts → fs
  error src-runtime-dep-is-yjs-only: src/project.ts → node_modules/fast-check/lib/cjs/fast-check.d.ts

Rules live in .dependency-cruiser.cjs; see docs/INVARIANTS.md (KA-3, FC-3).
$ echo $?
1
```

**5b. The same two mutants, with one rule made vacuous.** One field, widened so that no npm dependency can ever violate it — the same shape of defect as state 3, a filter that deletes the rule's matching set:

```bash
python3 - <<'EOF'
src = open('.dependency-cruiser.cjs').read()
open('/tmp/dc-yjsdead.cjs','w').write(
    src.replace('pathNot: "^node_modules/yjs(/|$)",', 'pathNot: "^node_modules",'))
EOF
```

```
$ ./node_modules/.bin/depcruise --config /tmp/dc-yjsdead.cjs src

  error src-no-node-builtins: src/doc.ts → fs

x 1 dependency violations (1 errors, 0 warnings). 11 modules, 25 dependencies cruised.

$ echo $?
1
```

**This is the finding.** Between 5a and 5b:

```
exitEq  = true   (1 and 1)
workEq  = true   (11 modules / 25 dependencies, both)
rulesEq = false  (two rule names, then one)
```

`exitEq=true, rulesEq=false` is the gate-shaped form of `bytesEq=false, projEq=true`. One of the four rules is dead. The exit code cannot say so; the work count cannot say so; `MIN_MODULES` is cleared in both. A reviewer who planted one violation, saw the gate go red, and recorded "import-graph gate proven non-vacuous" would have written a true sentence and a false claim. **P1 passed here honestly. The mutant landed exactly where intended and `git diff` confirms it. What failed is the observable the result was recorded in.**

**5c. What restores adequacy** is P1's own ratchet — one mutant per rule, not one per PR. Run the yjs-only mutant alone against the same neutered config and the rule's death is visible:

```
$ git checkout -- src/doc.ts       # leave only the fast-check import
$ ./node_modules/.bin/depcruise --config /tmp/dc-yjsdead.cjs src

✔ no dependency violations found (10 modules, 24 dependencies cruised)

$ echo $?
0
```

So "one mutant per rule" is not a style preference. It is the thing that makes a gate's exit code an adequate observable for the rule under test, by ensuring exactly one rule can be responsible for it. The reporting form that survives P10 is `mutant -> the named rule or test that went red`, never `mutant -> red`.

### Restore

```
$ git checkout -- src/doc.ts src/project.ts && mv /tmp/ts-hidden node_modules/typescript
$ npm run check:imports
import-graph check PASSED (9 modules, 23 dependencies cruised, 0 violations)
$ git status --porcelain
(empty)
```

No residual diff, as P1 requires. Neither variant config is checked in: a config that makes a rule vacuous, sitting next to a gate that reads `.dependency-cruiser.cjs` by default, is a loaded gun.

## What this fixture is for

Re-run states 1 to 5 whenever `vacuity.md`, `.dependency-cruiser.cjs`, or `scripts/check-import-graph.mjs` changes. If state 2 stops going red, or state 3 stops going green, or 5a and 5b stop agreeing on exit code and work count while disagreeing on rule names, the demonstration no longer demonstrates anything and this file is stale — which is the staleness signal `vacuity.md` P5 says every prose profile ought to have and most do not.

The generalizable form, for any check under review: find an input for which the check must go red, run it, paste the output, and **name what went red** — not that something did. If you cannot construct the input, that is the finding. If you can construct it but cannot name what went red, the observable is the finding.
