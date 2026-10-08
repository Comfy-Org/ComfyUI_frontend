# Vacuity review

A check that cannot fail for the reason it claims to guard is worse than no check: it manufactures confidence and suppresses the instinct to look. Most vacuity is not a broken tool. It is a truthful narrow result read as a much wider claim, a check that never ran, or a check reading a surface too coarse to hold the violation.

Applies to **every** check a change adds, modifies, quotes, or relies on: tests, CI gates, lint and analyzer invocations, the prose profiles in this directory, and any result cited as evidence in a PR body, ADR, or plan. Cite the affected `KA-*` / `FC-*` IDs from [`../../docs/INVARIANTS.md`](../../docs/INVARIANTS.md).

## If you read nothing else

Four rules. They are the whole profile; the rest is how to run them and where they bite.

1. **Write the failure sentence.** *"This check goes red when `<input or repo state>`, observed as `<test name / exit code / error>`."* If either blank will not fill, the check has no defined failure mode. (P0, 30 seconds, every change.)
2. **Break it and paste the red.** A claim of compliance with no pasted failure output is treated as **NOT RUN**, and the guard is reported unproven, not passing. (P1.)
3. **Confirm the mutant landed, and name what went red.** A green mutant run is ambiguous between "the check is vacuous" and "the edit did not land" — resolve it against `git diff`, never by inference. A red one proves only the row that reddened. `mutant -> red` is not a result; `mutant at file:line -> named failing check` is. (P1's own P0, plus P10.)
4. **Three outcomes, not two.** PASS `0` / FAIL `1` / INCONCLUSIVE `2`, with a work-unit floor. INCONCLUSIVE is not a pass.

Rule 4 is the only one that cannot rot, so prefer moving a rule into a gate's exit status over writing it down here.

## The five bands

| Band | Question | Sub-types | Probes |
| --- | --- | --- | --- |
| A — the check is wrong | Can it fail? | V1 unreachable input, V2 empty universe, V3 self-referential oracle, V4 divergent double | P1, P2, P3, P4 |
| E — the surface is too coarse | Could it fail *for this property*? | V10 wrong observable | P10, P11 |
| B — the check never executed | Did it run? | V5 silent skip, V6 inert check | P7 |
| C — the result was over-read | Does it say that? | V7 assertive documentation, V8 laundered evidence | P5, P8 |
| D — the number moves with the host | Does it mean the same thing twice? | V9 environment-coupled metric | P9 |

A, B and C are ordered because each disqualifies the next: there is no point asking what a result means if it never ran. D and E are not further along that line. **Band E is asked with band A, not after it** — it is the way band A's question gets answered "yes" and is still the wrong answer, and it is exactly where P1 returns a false all-clear. **A green P1 clears the check; only P10 clears the observable.** Band D is the one band where reading the output more carefully cannot help, because the two outcomes it confuses are the same symbol in the report.

## The ambiguity rule (design, not review)

Any check whose empty result is ambiguous between "clean" and "did not run" must report its unit of work and fail closed when that unit is zero. Three outcomes:

- **`0` PASS** — it ran, over a nonzero unit of work, and found nothing
- **`1` FAIL** — it ran and found something
- **`2` INCONCLUSIVE** — it could not run, or ran over nothing. **Not a pass.** Never report it as one.

Reference implementation: [`../../scripts/check-import-graph.mjs`](../../scripts/check-import-graph.mjs) exits `2` when it cruises fewer modules than the op layer has. `npm run check:purity` follows the same convention. See [`README.md`](README.md#gate-exit-code-convention) for the repo-wide convention and its one recorded exception.

## P0 (mandatory, every change) — state the failure

For each check the change adds or leans on, write rule 1's sentence in the PR body. The first blank must be a concrete input or repo state; the second must be an observable. If either cannot be filled, report it as a finding.

## P1 — mutant probe (tests, guards, and rules in a gate)

Revert the guarded behavior (**one mutant per source change or per rule, not one per PR** — a PR with six source changes and one red test has five unproven guards), run only the affected check, record `mutant -> failing check`, restore, confirm no residual diff.

**Paste the actual failure output** — test name and error text, or the gate's stderr and exit code. A P1 claim with no pasted red output is treated as NOT RUN, and the guard is reported as unproven, not as passing.

### P1's own P0: confirm the mutant landed

**A green mutant run is ambiguous** between "the check is vacuous" and "the edit did not go where you think it did". Resolve it against `git diff`, never by inference.

```bash
# comment out the guard line, then:
git diff --stat && git diff   # FIRST: confirm the hunk is at the file and line the property lives at
npx vitest run test/<file>.test.ts
git checkout -- src/<file>.ts
```

- Read the diff **before** you read the test output, and report the file and line the mutant landed at alongside the failing check. `mutant -> failing check` is evidence only if the left-hand side is verifiable.
- Repeated wiring idioms collide by shape — route tables, middleware chains, DI containers, switch arms, config blocks, rule lists. A `/ws` route mutation in the `cloud` repo silently matched an auth group with an identical middleware shape earlier in the same file and came back green; a reviewer reading only the test output would have recorded the guard as vacuous.
- Prefer a mutation whose failure to land leaves a residue: delete the symbol, not the call site, so the compiler or linter objects. Unused-symbol lint is the cheapest available detector of an edit that did not land.
- **A green demonstration is not a result until you can point at the diff that produced it.**

### P1 for a gate, and for V1

For a gate, plant one violation **per rule**, and include a row reproducing the original failure mode the gate was written to catch. One exit code covers a gate's whole rule set, so a single planted violation proves one rule and says nothing about the others — see [`vacuity.worked-example.md`](vacuity.worked-example.md) state 5, where a dead rule and a live one give the same exit code over the same work count, and only a one-mutant-per-rule run tells them apart.

For V1 specifically, the mutant must be run against the **general** input, not the pinned one. If reverting the fix leaves the test green, the input never reached the guard. That is the `removed_links: []` signature: the parameter the bug is about sitting at its empty or identity value. When the mutant survives, go to P11 before concluding "equivalent mutant".

Precedents in this repo, each on its own branch rather than on `main` as of 2026-08-21: PR #31 tabulated six individual mutants against six distinct failures; PR #29 re-appended `export * from "./doc.js"` to `src/index.ts` to prove its `test/public-api.regression.test.ts` was non-vacuous; PR #52 planted one violation per import-graph rule **and discovered that its own first rule set passed a planted `node:fs` import**, because `--include-only` had already removed `fs` from the graph.

If no mutant can turn the check red, the check is vacuous. **Blocking.**

## P2 — nonzero work unit (gates, analyzers)

Never accept "0 violations" without the count of things examined.

```bash
npm run check:imports                  # exits 2 below the module floor
npx depcruise --info                   # `x .ts` means the extension is DISABLED
```

- A tool that prints `0 modules cruised` / `0 files scanned` / an empty `.paths.scanned` and exits `0` is INCONCLUSIVE, not a pass. **Blocking** if reported as a pass.
- The sharpest form of this tell is that **the number was already in the output**: `no dependency violations found (0 modules, 0 dependencies cruised)` says both things on one line, and this repo read it as success for as long as the profile existed.
- Precondition sweep, since every instance found here was precondition-shaped: `node_modules` present; transpiler resolvable from the tool's install location; rule fetch completed; clone not shallow; no filter flag removing the modules the rule matches on (`--include-only` deletes them from the graph, `--do-not-follow` keeps them as edges).
- Prefer a checked-in gate with a work-unit floor over a copy-pasted command. A gate enforces its own floor; a Markdown snippet rots unnoticed.
- Any documented invocation in this directory must record the work count it produced on this repo, with the date, so the next reader can diff it.
- **A passing work count is not a passing P1.** A floor proves the tool looked at something, not that the rule can fire over what it looked at. The worked example's vacuous variant cruises 8 modules, clears the floor, and still cannot see the planted violation.

## P3 — oracle independence (fixtures, corpora, baselines)

The expected value, and the set of items expectations are asserted over, must not be produced by running the code under test. A regression must fail the check, not silently shrink the assertion set.

- `grep -n '<sutSymbol>' <testfile>`: any hit inside expectation *construction* (as opposed to exercise) is a self-referential oracle. **Blocking.**
- Reject a data-dependent assertion set (`it.each(computedSet)`) and a bare `catch {}` in expectation setup.
- An aggregate floor or percentage is not an oracle. It is a budget for undetected regressions, and its size is the number of regressions you have agreed not to see. Prefer a checked-in named known-failing allowlist where both a new divergence and a stale entry fail by name, and where a wildcard entry requires a structural marker so an unrelated regression cannot hide behind it.
- In this repo the conformance corpus (`npm run verify:corpus`) is the highest-risk host: fixtures regenerated by the applier under test would assert only that the applier agrees with itself.

## P4 — double parity (fakes, stubs, injected seams)

For the exact property asserted, the double must behave like the real collaborator.

- Read the property's implementation in the real type and in the double side by side. A plain field standing in for an accessor with side effects, or a test-supplied closure standing in for a singleton write, means the assertion is about the double. **Blocking** when the property is the point of the test.
- Decisive question: **would this test still pass if the production mechanism were deleted?** If yes, the test is about the double.
- Prefer one shared parametrized suite run against both the double and the real collaborator, or one integration test that drives the real object once. Ten unit tests against fakes do not add up to it.

## P5 — documentation fact-check (this directory, ADRs, `INVARIANTS.md`)

Prose here is executed by reviewer agents. A false code fact does not merely fail to catch a defect, it argues for one.

- For each factual claim, `grep -n` the named symbol at the named path. A contradiction is **blocking**, not a doc nit.
- Prefer **rules** ("do not export handles that permit unstamped writes") over **contracts** ("`index.ts` re-exports `doc`"). Rules survive a refactor; contracts age. Where a contract must be stated, carry `file:line` and the SHA it was true at.
- A PR removing or renaming a symbol named in this directory, an ADR, or `docs/INVARIANTS.md` must update that prose in the same commit. Grep `.agents/` and `docs/` for every removed or renamed symbol in the diff.
- Known live example: `api-contract.md` §1 described `src/index.ts` as re-exporting `doc` after PR #29 removed it, which would have coached reviewers to flag the fix and bless re-adding the vulnerability. An assertive profile does not fail to detect the defect; it **inverts** and recommends it.

## P6 — green on empty

Any check whose "nothing to do" branch is a skip, a pass, or an early return is a latent vacuous green. Make the empty case an error.

`else it.skip('no fixtures currently pass')` is the exact line that lets total failure and total success differ only in the count of green test names, and `PASSED (0 files)` from a corpus verifier over an empty manifest is the same line waiting to happen.

## P7 — did it run, and has it ever run

Two different questions. Ask both.

```bash
npx vitest run --reporter=verbose                        # passed / skipped / todo
grep -rn "it.skip\|describe.skip\|it.todo\|skipIf" test/ # local skip gates
git grep <THE_SKIP_GATE_ENV_VAR> origin/main -- .github/ # no hit = it has never run
gh api repos/:owner/:repo/actions/workflows/<wf>.yml/runs --jq '.total_count'   # 0 = never fired
```

- An executed count of zero is an abstention, not a pass. Any evidence line citing a run must carry the executed count, or the preconditions that make the run meaningful. `# all ok` is not evidence.
- For every environment-gated skip, name the environment that guarantees it does not fire, then open that CI file and confirm the job is not path-filtered or matrix-gated away from the changes it protects.
- A correctly configured scheduled job that has never reached its cron slot is the purest case: there is no skip gate to grep, only the run count to ask for. "Scheduled" is not "green".
- **Blocking** when a committed check has never executed in CI, or when the only run that exercises a guard cannot be triggered by a change to what the guard covers. Let a local checkout skip; make the authoritative environment fail closed.

## P8 — open the citation

Before repeating a claim, open the artifact it cites and read the text next to the number.

- Look for the source's own scope disclaimer: "does not", "not exercised", "out of scope", "analogy", "simulated", "in isolation". If the source qualifies its result, the qualification travels with it.
- **One-hop rule:** cite the artifact, never a document that cites the artifact. Chains launder, and each re-citation strips context while confidence rises.
- Reserve **"proven"** for a property with an executable check that can go red. Otherwise write "observed", "demonstrated in isolation", or "argued by analogy".
- Re-derive `file:line` citations against current `origin/main` before escalating. A report can be right on mechanism and unusable on currency.
- **Blocking** when a status table marks a row proven on evidence that excludes the thing the row names.
- The reviewer's version, which costs the least and is skipped the most: any confident claim whose cited evidence you have not personally opened is unverified. Say so rather than inheriting it.

## P9 — perturb the environment (aggregate quality metrics)

Before trusting a score, change something that should not matter and see whether it moves.

```bash
npm run test:mutation                                       # as configured
npx stryker run --timeoutMS 60000 --concurrency 4           # same commit, different host pressure
```

- Ask which distinct outcomes the tool collapses into "good", and whether any is a **resource-exhaustion** outcome: `Timeout` counted as killed, a retried flake counted as a pass, an unparseable file counted as lint-clean, an unloadable module counted as covered. A score that *rises* under load is measuring contention.
- Confirm the knobs governing that collapse are pinned in config. `stryker.config.mjs` must keep `timeoutMS` and `concurrency` explicit, or the score becomes a property of the runner rather than of the tests. Compare figures only when those settings match; if either pin disappears or changes, re-establish a baseline instead of extending the old trend line.
- Hand-verify any subsystem reported at or near 100%: apply two or three of its "killed" mutants by hand and run the full suite. **No reading of the output reveals this band** — a timeout and a kill are the same symbol in the report — so this is P1 applied to the tool that automates P1, and it is the only thing that settles it.
- **Blocking** when a quality metric moves materially under environment change alone, or when such a metric is quoted without the configuration that produced it, or used as a gate threshold or a trend line. Report "not comparable" rather than a trend.

## P10 — observable adequacy (any assertion about a doc, wire, or replication property)

Do not ask whether the assertion is true. Ask whether it has **room to be false**.

**The question:** name the value the assertion reads, then answer — *what is the smallest violation of this property that leaves that value unchanged?* If you can construct one, the observable is inadequate. **Blocking** when the property is a `KA-*` invariant.

In this repo the hazard has a name. `project()` is a lossy view: correct, production code, used correctly, and it does not render `__stamps` or `__applied` — `grep -n '__stamps\|__applied' src/project.ts` returns nothing, while `appliedMap` and `stampsMap` in `src/doc.ts` are where they live. Every convergence-relevant invariant is defined over `Y.encodeStateAsUpdate`. Print both for one case and the finding is two words:

```ts
const before = Y.encodeStateAsUpdate(doc)
// ... run the op that must be rejected ...
// bytesEq=false, projEq=true  ->  the projection is not an adequate observable here
```

- Assert **byte identity, not projection identity**, for anything about rejection, ordering, stamps, idempotency records, tombstones or schema layout. The reference is `test/ka4-rejection-byte-identity.test.ts`, one row per reachable rejection code, asserting `Y.encodeStateAsUpdate` identity plus `op_id` absence from `__applied` (landed on `main` via #58; its issue-#10 rows moved out of `KNOWN_KA4_VIOLATIONS` into `CASES` when #34 landed). Its comment states the choice deliberately — "deliberately not 'the projection is unchanged'" is the line that stops the next person simplifying the assertion back to the convenient form.
- The exception, so this does not overreach: an **accepted** delete-wins or LWW-dropped no-op deliberately consumes an `op_id`, so its bytes are intentionally not identical. Byte identity is the assertion of record for **rejected** ops; projection comparison remains right for accepted no-ops.
- **Composes with P1, and must.** A guard whose revert turns *some* rows of a suite red proves only those rows. Check that the row naming the property is among them.
- Suspect V10 whenever the property names a serialization, a replication state, or internal bookkeeping and the assertion reads a rendered view; whenever the system has a *canonical* form and a *convenient* one and the test uses the convenient one; or whenever the asserted value is **computed by the code under test** (a counter, an `applied_count`, a `changed` flag) — that last is V10 meeting V3, and `mutations++` → `mutations--` has been measured surviving in three of this package's write helpers, because the bounded-writes test compares the count against a ceiling.
- Fix shapes in order: assert on the canonical representation; else pin a checked-in golden vector of it; else write down **in the test file** which violations the view cannot see. A recorded limitation is not vacuity; an assumed absence is.
- The same question applies to a **gate**: its exit code is a one-bit projection of its rule set. See [`vacuity.worked-example.md`](vacuity.worked-example.md) state 5.

## P11 — fixture adequacy (any fixture a guard is proven against)

**Vary the fixture until the assertion would be sensitive to the mutation, then confirm that it is.** Mechanical, and it terminates.

1. Name the mutation the fixture must catch. If you are here from P1, you already have it.
2. Run it. **Green means the fixture is inadequate, not that the code is correct.**
3. Grow the fixture one dimension at a time, in this order:
   - **cardinality** — 0, 1, 2, **3**. Most "exactly one" / "unique" / "the only" / "at most one" predicates first become falsifiable at three. Two is the trap: a two-element fixture cannot distinguish "exactly one" from "all but one".
   - **occupancy** — empty vs populated vs *already*-populated. `emptyWorkflow` cannot exhibit "leaves the document byte-identical"; a node that already has a widgets map cannot exercise a guard that fires when the map is created.
   - **distinctness** — make values that could coincide differ: a stem equal to its prefix, a stamp equal to its envelope, a name equal to an id.
   - **shape** — non-empty where every fixture was empty, nested where every fixture was flat, a second instance where every fixture had one.
4. Re-run the mutant. Red means adequate — keep the enlarged fixture as the test's fixture, not as an extra case.

- Stop at the first fixture that kills the mutant. That one is by construction the *smallest interesting* instance, which is what V1's tell asks for and what a degenerate fixture is not.
- **"Equivalent mutant" is a claim, not a default.** It is honest only after all four dimensions have been tried and written down. Argue it by writing the kill test and watching it pass under the mutant — a candidate kill test that turns out to be false on *clean* code is itself a finding.
- Cheapest preventive form, needing nothing run: read the fixture's cardinality and occupancy out loud against the property's quantifier.
- **Major** when a guard's fixture is degenerate on a dimension the property quantifies over; **blocking** when the enlarged fixture shows the guard does not hold.

## Reporting

State the probes you ran and the artifacts they produced, not that you ran them:

- P1 — the pasted red output **and the diff hunk the mutant landed at**, per mutant
- P2 — the pasted work count, per tool
- P7 — the pasted executed/skipped counts, per suite
- P9 — the score **and** the pinned configuration that produced it
- P10 — the value asserted on, and the smallest violation that would leave it unchanged

A line reading "vacuity check: PASS" with no such artifact is itself the failure mode this profile exists to catch (V7), and is reported as NOT RUN.

## Severity

- **Blocking** — no mutant can turn the check red; an oracle computed from the code under test; a gate whose work count is zero reported as a pass; a prose profile in this directory asserting a false code fact; a double that diverges on the asserted property; a committed check that has never run in CI; a guard whose real run is unreachable from the changes it covers; a "proven" row whose cited evidence excludes the property; a quality metric that moves under environment change alone; **an assertion on an observable that cannot represent a violation of the `KA-*` invariant it names**; **a P1 demonstration reported green without the diff showing where the mutant landed**.
- **Major** — P0 unanswered for a new guard; an aggregate floor where per-item expectations are possible; a green-on-empty branch; an aggregate verdict quoted with no counts; an INCONCLUSIVE exit code the profile does not document; a score quoted without its configuration; **a guard's fixture degenerate on a dimension the property quantifies over**; **an "equivalent mutant" dismissal with no kill test written and run**; **a gate proven by one planted violation and reported as covering all of its rules**.
- **Minor** — a documented invocation with no recorded work count; a fake with no contract test but no divergence on the asserted property; a two-hop citation whose source does check out; **a test using the convenient observable where the canonical one is available and the two provably agree for this property** (record the reasoning, do not block).

## This profile applied to itself

A vacuousness check can itself be vacuous — not a rhetorical caveat: it happened to the author of PR #52 within an hour of starting the fix. So this profile carries its own P1 and its own P10. [`vacuity.worked-example.md`](vacuity.worked-example.md) runs the probes against a check that was genuinely vacuous, with real pasted output, and then turns P10 on the demonstration itself: **state 5 is a case where P1 goes honestly red and the property is still unproven, because the observable a reviewer records — an exit code — cannot express which of a gate's rules fired.** If state 2 stops going red, or state 3 or state 5 stops going green in the coarse observable, the demonstration no longer demonstrates anything and this file is stale.
