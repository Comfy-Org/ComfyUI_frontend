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
  <!-- claim-absent: <exact substring> :: <repo-relative path> -->
  <!-- known-defect: <#issue> :: <exact substring> :: <repo-relative path> -->
```

(Indented here only because they are examples. **This file is not scanned for markers** — it is the convention doc, so its examples would otherwise run as claims — and a marker written here at column 0 is a hard error rather than a silent no-op, because an inert marker is the exact failure this gate exists to stop. Put real markers in the profile that owns the fact.) The third form is a tombstone for a defect you have diagnosed and are deliberately not fixing; it has its own section below.

`npm run check:profile-claims` ([`../../scripts/check-profile-claims.mjs`](../../scripts/check-profile-claims.mjs)) asserts every `claim` substring is still present verbatim in its cited file, and every `claim-absent` substring is still *missing* from it. If an export is renamed or a file moves, the claim goes stale and the gate fails, forcing the prose to be corrected. The gate exits `2` (INCONCLUSIVE) if a profile set carries no **presence** claims — bans and tombstones do not count towards that floor, because neither anchors a restated fact — so a profile that restates code facts without anchoring them is treated as an unverified pass, not a clean one. Keep the substring narrow enough to actually break when the fact changes.

**Use `claim-absent` for the two things the positive form structurally cannot say.** First, a fact whose content is an absence — `test-quality.md` argues that a projection is the wrong oracle for a rejection *because* `src/project.ts` reads neither the stamps nor the applied-ops ledger. Second, **advice that was retired for being wrong**: point a `claim-absent` at the profile itself so re-typing the retired sentence fails the gate. `test-quality.md` §2 told reviewers to compare a `project()` snapshot across a rejection, an oracle that cannot see most of the damage a rejection does. It survived a correction pass over its own file — #56 rewrote the conventions block lower down and left it standing — and four later changes (#34, #58, #60, #62) whose review notes named the defect and deferred it, because a prose profile is never in a code PR's diff. (Those notes are kept outside this repository, in the in-app-agent workspace, the same convention `test/ka4-rejection-byte-identity.test.ts` uses.) Prose alone would let it survive a fifth. Claim markers are stripped from a target's text before either test runs, which is what makes a self-targeted ban work and also stops a positive claim being satisfied by nothing but another marker.

**An absence claim is only as good as the names it enumerates, and it is a substring test, not a semantic one.** Cover every plausible *spelling* of the thing you say is absent, not just the one you happen to think of: a projection that started rendering a ledger would most likely do it by importing `stampsMap` from `doc.js`, never naming `__stamps` at all, so banning the literal alone would have left the realistic drift path unguarded. Ban the accessor names too. Expect the reverse cost as well — a ban fires on a *mention*, so a future comment in the target that merely names the banned string breaks CI with no behavioural change. That is the intended trade (loud and one reword to fix), not a bug, but it is a reason to keep bans few and load-bearing.

**Check a needle by applying the change it is supposed to catch.** Reading it is not enough: the
`#16` tombstone went through two needles that each looked unique and each failed a real edit — one
survived the rename it existed to catch (`doc_version: number;` contains `version: number;`), the
next matched a different line entirely. Both were green the whole time.

**A needle is `.trim()`ed, so it can never rely on LEADING or TRAILING whitespace.** This is a
landmine, because the degradation is silent and in the unsafe direction: `  version: number;`, chosen
to exclude `base_version: number;` two hundred lines above it, is stored as `version: number;` — which
`base_version: number;` contains. The marker then passes forever, against the wrong line, and the
tombstone or claim is vacuous. If uniqueness depends on indentation, anchor on a non-space character
instead — the end of the line above (`*/`) or the line below (`}`) — and pick whichever of those an
unrelated edit is less likely to disturb.

**Prefer needles that no reflow can split.** The gate reads raw file text. In a YAML folded scalar (`>-`), which is how [`../../.coderabbit.yaml`](../../.coderabbit.yaml) carries its `path_instructions`, a purely cosmetic rewrap inserts a newline at a space — which turns a positive claim red for no reason and, worse, makes a `claim-absent` silently stop firing. A needle containing no spaces cannot be broken that way, so use one there. The same hazard exists in Markdown, and this directory now hosts hard-wrapped bot instruction text: a multi-word ban on a phrase in a profile stops firing the moment someone wraps that phrase across two lines. Prefer short, space-free needles everywhere; a multi-word ban is a tripwire on one spelling of one line, not a rule.

Targets are ordinary repo-relative paths, so they are not limited to `src/`. Where the same advice exists in a machine-consumed copy — `.coderabbit.yaml`'s `path_instructions`, the copy that actually runs on every PR — anchor the profile's wording to the copy in both directions (`claim` on the corrected phrasing, `claim-absent` on the retired one). Fixing one site and not the other is how the `test-quality.md` oracle survived. That file is now generated (next section), which makes the transport exact; the markers remain the check on the *content*, because a source block that was re-typed wrongly regenerates perfectly cleanly.

## Tombstones for a defect you are not fixing

A reviewer who finds a real defect outside their change's scope is right to leave it. What is not right is leaving **no trace in the repository**. The rejection-oracle line in `test-quality.md` was diagnosed independently by two merge reviews (#34, #58) and relayed into a third (#60), each of which correctly scoped it out; every finding went into a report in a workspace outside this repo, and `gh api` confirms **zero** GitHub reviews and **zero** inline comments on those PRs. So nobody editing that file ever met a warning, and a defect that had been diagnosed three times outlived all three. It was not undiscovered. It was never deposited.

The third marker form is the deposit:

```
  <!-- known-defect: <#issue> :: <exact substring> :: <repo-relative path> -->
```

(indented, like the examples above, because this file is not scanned for markers)

It asserts the defective text is **still there** and fails when it is gone, telling whoever removed it to delete the tombstone and close the issue. `npm run check:profile-claims` prints the standing roster on every green run.

Four properties, and each one is why a cheaper option was rejected:

- **It fires at the moment someone touches the defect.** Change the text a tombstone names and CI reddens with the issue number attached. A *code comment at the site* is the obvious alternative and is worse: nothing keeps it true, nothing removes it when the defect is fixed, and a stale comment describing a closed defect is itself the assertive-documentation failure [`vacuity.md`](vacuity.md) P5 is about. A comment is visible only to someone already reading that exact region; the gate reaches anyone who changes it.
- **It costs one line, so it actually gets written.** *Filing an issue* is strictly better as a record — it has an owner, a thread and a close event — and it is exactly what those three reviews did not do. This form does not replace the issue, it **asks for** one: the marker is malformed without an issue reference. Be precise about how much that buys — the gate checks the reference's *shape*, so `#99999` passes, and filing remains, as the proposal that prompted this said, the social half that no gate can force. What it does buy is that the cheapest way to write a tombstone is to file first.
- **It is a merge-blocking obligation, not a ledger entry.** *An entry in a checked file* — a `KNOWN-DEFECTS.md` — is visible only to someone who goes looking for it. Binding the entry to a substring at the site is what turns a list into a gate. Note the one ledger this repo already has and this does **not** replace: [`../../docs/decisions/EXCEPTIONS.md`](../../docs/decisions/EXCEPTIONS.md) records a deliberate deviation from an invariant, with a maintainer, a scope and an expiry. A tombstone is the opposite case — a defect nobody has decided to keep, whose sunset is the issue closing. If the decision is to keep the behaviour, it belongs in `EXCEPTIONS.md`, not here.
- **It reuses the mechanism that already exists.** Same file, same parser, same CI step, same conventions as `claim` and `claim-absent`. A parallel gate with its own format would be a second thing to learn and a second thing to rot.

What it deliberately does **not** do:

- **It cannot tell whether the issue is still open**, so a tombstone for an issue closed as wontfix stands forever. That check needs the network. It is implementable as an opt-in flag the way `check:pins -- --verify-remote` is, and it is deliberately not built: this gate is merge-blocking on every PR, and a merge-blocking verdict that depends on GitHub being reachable is worse than no verdict. The roster is a prompt to look, not an assertion that the issue is live, and its printed header says so.
- **It does not live at the site.** Markers are only read from `.agents/checks/*.md`, so a tombstone is hosted by the profile whose concern the defect belongs to and points at the site. Widening the scan to the whole tree would make every file a marker surface for a much smaller gain.
- **It is a substring test, so the needle is the whole design.** Reword the defect without fixing it and the tombstone goes red — a false alarm whose fix is one line. Worse and quieter: point it at prose *near* the defect rather than at the defect, and the real fix leaves the needle standing, so the roster keeps advertising a defect that is gone. Pick text that only the actual fix can change, and check that by applying the fix and watching the gate go red. Keep tombstones few and load-bearing.
- **A defect of pure omission cannot be tombstoned.** There is no substring to point at. Use `claim-absent` when the *wrong* thing is present, and an issue alone when nothing is.

## The machine-consumed copy (`.coderabbit.yaml`)

`.coderabbit.yaml`'s `reviews.path_instructions` is the restatement of these profiles that CodeRabbit executes on every PR. It used to be hand-written, and it drifted. #43 (`7c454eb`) created the `test/**` entry and `test-quality.md` §2 in one commit carrying the same wrong rejection oracle. #53 (`547ae7b`) then corrected the profile and left this file saying the retired thing — one copy fixed, the copy that actually runs on every PR left wrong, because neither was greppable from the other — and #56 (`0231199`) edited the same profile nine lines below and walked past it. It took #74 (`2e42423`) to find both by hand and fix them together.

**A note on the record**, because this work was filed as blocked and is not: #74's follow-up ledger recorded generation as *"blocked on CodeRabbit reading a generated file, which it does not"*. That is a category error. CodeRabbit reads the **committed** `.coderabbit.yaml` at the PR head and has no opinion about what produced those bytes; "generated" here means a committed build product with a gate asserting it is still the product of its source, not an artifact assembled at review time. Both gates **detect** rather than prevent — a PR that drifts the config is still reviewed against its own drifted head — but it cannot merge.

**The list is now generated.** Each entry is authored inside the profile that owns its glob, in a delimited block:

````
  <!-- coderabbit-instructions: test/** -->
  ```text
  ...the instruction the bot receives, verbatim...
  ```
  <!-- /coderabbit-instructions -->
````

(indented here only so this example is not itself collected — the generator reads markers at column 0)

`npm run gen:coderabbit` ([`../../scripts/gen-coderabbit-config.mjs`](../../scripts/gen-coderabbit-config.mjs)) splices those blocks into the sentinel-delimited region of `.coderabbit.yaml`; `npm run check:coderabbit` regenerates in memory and fails CI on any difference. The block body is whitespace-normalized to one paragraph and emitted as a YAML folded scalar, so authoring line breaks are free and the wrap is deterministic.

Five rules for authoring a block:

- **Write it for the bot, not for a human.** `path_instructions` are injected as literal text and no profile is loaded alongside them, so `"Apply .agents/checks/test-quality.md"` is a filename to CodeRabbit, not a way to include that file. Naming a profile as a *label* for a finding is fine; relying on one for content is not. Three of the five blocks currently open by naming a profile — inherited wording, not a licence — see [#80](https://github.com/Comfy-Org/comfy-multi-player/issues/80).
- **Carry the carve-outs.** A restatement drifts by *omission* as readily as by contradiction, and omission is invisible to a phrase-pinning gate. The first draft of the `test/**` block dropped item 3's accepted-op exception and would have had the bot flagging seven suites that compare projections correctly. An instruction that fires on legitimate code is worse than no instruction, because it teaches people to ignore the bot.
- **Only edit the block.** Editing the generated region of `.coderabbit.yaml` directly is what `check:coderabbit` exists to catch; the fix is to move the edit into the profile and regenerate.
- **Everything outside the sentinels is hand-written and preserved.** The generator owns one region, so ordinary CodeRabbit configuration can live in the same file untouched. That affordance is also the sharpest hazard: a second `path_instructions:` key elsewhere in the file wins over the generated one, and deleting the `reviews:` line leaves the region byte-perfect and inert. Both were reproduced against an earlier draft of this gate and left it green, so it now checks them structurally. It still does not parse YAML — a syntax error in the hand-written part is CodeRabbit's own error to report.
- **Anchor the block's content.** Byte-equality with the source block says nothing about whether the source block is right, and a body replaced with plausible prose regenerates perfectly. Give every block at least one `claim` needle into `.coderabbit.yaml` from the profile that owns it, and a `claim-absent` for any wording retired as wrong. Space-free needles only: the YAML carries them in a folded scalar, where every space is a legal line break.

One glob has no single owning profile — the whole-`src/**` umbrella, which is "apply every applicable profile" — so its block lives here, in the index. It is hosted rather than owned. The other four sit in the profile that covers their glob: `test/**` in [`test-quality.md`](test-quality.md), the fixtures glob in [`catalog-pinning.md`](catalog-pinning.md), and `scripts/**` plus the build/CI contract in [`purity.md`](purity.md), whose opening line already scopes it to package metadata, build configuration and dependencies.

<!-- coderabbit-instructions: src/** -->
```text
Review against docs/INVARIANTS.md and every applicable profile in
.agents/checks/. Cite stable KA-* and FC-* IDs. Treat purity,
convergence/idempotency, op identity, catalog pinning, and follower boundary
violations as correctness issues. Any op-layer path that can mutate the Yjs
doc and then throw (leaving a partial mutation and a skipped op_id record)
is a blocking KA-4 issue (see issue #10); require validate-before-mutate.
Any second op-to-document implementation is a blocking FC-3 issue.
```
<!-- /coderabbit-instructions -->

This `src/**` block was audited against the code for
[#80](https://github.com/Comfy-Org/comfy-multi-player/issues/80) and verified without a wording
change.

**What generation does not fix.** It removes the second *editable* copy, not the second *statement*: the block and the profile prose around it can still say different things, and no gate reads either. What changed is that they are now adjacent in one file rather than in two files in two formats, so the edit that fixes one is made by someone looking at the other. The content check remains the claim markers — and those are substring tripwires, so a **paraphrase** of retired advice written into a source block regenerates cleanly and passes everything. That residue is unchanged from #74 and no substring gate closes it.
