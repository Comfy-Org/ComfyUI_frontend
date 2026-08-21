# Reviewer-agent check profiles

Concern profiles a reviewer agent (or a human) applies to a change. Apply every profile relevant to the change; cite the affected `KA-*` / `FC-*` IDs from [`../../docs/INVARIANTS.md`](../../docs/INVARIANTS.md).

## Apply to every change

| Profile | Focus |
| --- | --- |
| [`vacuity.md`](vacuity.md) | can this check fail — and fail *for this property* — did it run, does the result say what is claimed from it, and does the number mean the same thing twice |

[`vacuity.md`](vacuity.md) is not a concern like the others — it is the check on the checks, and every other profile in this directory ends with a one-line pointer to it (`grep -rn "apply \[vacuity.md\]" .agents/checks/`). It applies to tests, gates, analyzer invocations, the prose in this directory, and any result cited as evidence in a PR body, ADR, or plan. [`vacuity.worked-example.md`](vacuity.worked-example.md) is its self-application: the probes run against a check that was genuinely vacuous, with the real output, plus a case where the probe goes honestly red and the guard is still unproven because the observable a reviewer records — an exit code — cannot say which of a gate's rules fired.

## Gate exit-code convention

**Every checked-in gate in this repo reports three outcomes, not two.** Stated as a rule, because it is not yet a fact: see the recorded exception below.

| Exit | Meaning | How to report it |
| --- | --- | --- |
| `0` | **PASS** — it ran, over a nonzero unit of work, and found nothing | "No issues found (`<n>` units examined)" — always with the count |
| `1` | **FAIL** — it ran and found something | the findings |
| `2` | **INCONCLUSIVE** — it could not run, or ran over nothing | "INCONCLUSIVE — `<reason>`". **Never a pass.** Fix the precondition and re-run |

A gate must therefore report its unit of work (modules cruised, files linted, packages audited, tests executed) and exit `2` when that unit falls below a floor, because an empty result is otherwise ambiguous between "clean" and "did not run" and every tool resolves that ambiguity in favour of green.

Reference implementation: [`../../scripts/check-import-graph.mjs`](../../scripts/check-import-graph.mjs), which exits `2` when it cruises fewer modules than the op layer has (`MIN_MODULES`; raise it if the layer grows, never lower it to make a run pass). `npm run check:purity` follows the same convention: `2` means no `dist/` or no `node_modules`. New gates should copy the shape.

**Recorded exception, with a sunset.** `scripts/verify-corpus.mjs` fails closed when the manifest lists zero fixtures and when a fixture is present but unlisted, and its success output reports the verified file count. It still exits only `0` or `1`: malformed input and empty-work preconditions are reported as failures (`1`), not as the convention's distinct INCONCLUSIVE outcome (`2`). Until it distinguishes those outcomes, report the failure reason rather than treating every nonzero result as evidence that the corpus contents are wrong. Writing the convention down while one gate violates part of it is exactly the assertive-documentation failure [`vacuity.md`](vacuity.md) P5 is about, so it is named here rather than glossed.

This convention is the load-bearing part of everything below it. The profiles are prose and can rot; an exit code cannot. Documentation asks a reviewer to remember, so anything that can be moved out of a profile and into a gate's exit status should be.

## Non-vacuousness rule

The rule below is the authoring-side summary; [`vacuity.md`](vacuity.md) is its operational form for a reviewer.

A profile that reports "no issues found" without having analyzed anything is worse than no profile: it manufactures false confidence and the reviewer stops looking. Two instances have already shipped here — `api-contract.md` §1 described an entrypoint re-export that issue #18 removes (so the profile coached reviewers into blessing the vulnerability), and `import-graph.md` documented a `dependency-cruiser` invocation that cruised **0 modules** and reported a clean graph.

So, for every profile that runs a command:

- **Report what was analyzed, not just what was found.** Quote the counts — modules cruised, files linted, packages audited, rules loaded. A count of zero is the finding.
- **A tool that did not run is INCONCLUSIVE, never green.** Distinguish "ran and found nothing" from "could not run", "found no files to look at", and "silently skipped every file". Only the first is "No issues found".
- **Prefer a checked-in gate over a copy-pasted command.** `npm run check:imports` and `npm run check:purity` can enforce their own floors; a shell snippet in a Markdown file cannot, and it rots without anyone noticing.
- **When a profile asserts a fact about the code** (an export exists, a file re-exports another), it is a claim that can go stale. Re-read the source before relying on it, and fix the profile in the same change.

## CRDT / op-layer profiles (this repo's core)

| Profile | Protects | Apply to |
| --- | --- | --- |
| [`purity.md`](purity.md) | KA-3, FC-3 | exports, deps, build, applier/projection/mint |
| [`convergence-idempotency.md`](convergence-idempotency.md) | KA-4 | applier, ordering, dedupe |
| [`op-identity.md`](op-identity.md) | KA-2, KA-4, FC-2, FC-7, FC-9 | mint, retry, stamps, LWW |
| [`follower-boundary.md`](follower-boundary.md) | KA-6, FC-5 | replication / write boundary |
| [`catalog-pinning.md`](catalog-pinning.md) | KA-12, FC-10 | widget catalog, mint |

## General engineering profiles (ported from ComfyUI_frontend `.agents/checks/`, adapted to this pure library)

| Profile | Focus |
| --- | --- |
| [`architecture-reviewer.md`](architecture-reviewer.md) | structure, over/under-engineering, single-implementation rule |
| [`complexity.md`](complexity.md) | cyclomatic complexity, nesting, duplication |
| [`error-handling.md`](error-handling.md) | fail-closed, no swallow, mutate-before-throw (issue #10), abort-remainder |
| [`regression-risk.md`](regression-risk.md) | git-blame bugfix-line detection |
| [`test-quality.md`](test-quality.md) | assertion strength, convergence/idempotency coverage, Vitest/`test/` conventions |
| [`import-graph.md`](import-graph.md) | circular deps, layer/purity boundaries (`npm run check:imports`, rules in [`../../.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs)) |
| [`api-contract.md`](api-contract.md) | exports, op vocabulary, wire envelope, schema/catalog versioning |
| [`dep-secrets-scan.md`](dep-secrets-scan.md) | npm audit + gitleaks; yjs-only dep set |
| [`semgrep-sast.md`](semgrep-sast.md) | dangerous patterns, weak randomness on the mint path |
| [`sonarjs-lint.md`](sonarjs-lint.md) | SonarJS bug/smell rules (config: [`eslint.strict.config.js`](eslint.strict.config.js)) |

The general profiles were adapted from the frontend versions: FE-only context (Vue/Pinia, `window` globals, LiteGraph, `pnpm`, colocated tests, `useErrorHandling`) was replaced with this repo's reality — a pure `yjs`-only op-layer, `npm`, Vitest under `test/`, `OpRejectedError`/fail-closed semantics, and the `src/index.ts` + wire-envelope contract.

## Keeping restated code facts from going stale

These profiles are prose, so any code fact they restate (an exported symbol name, the wire envelope shape, an invariant ID) can drift out of sync with the code without anyone noticing — `api-contract.md` once described an export that had already been removed. Annotate each load-bearing, checkable fact with an inline claim marker:

```
<!-- claim: <exact substring> :: <repo-relative path> -->
```

`npm run check:profile-claims` ([`../../scripts/check-profile-claims.mjs`](../../scripts/check-profile-claims.mjs)) asserts every `<exact substring>` is still present verbatim in its cited file. If an export is renamed or a file moves, the claim goes stale and the gate fails, forcing the prose to be corrected. The gate exits `2` (INCONCLUSIVE) if a profile set has no markers at all, so a profile that restates code facts without anchoring them is treated as an unverified pass, not a clean one. Keep the substring narrow enough to actually break when the fact changes.
