> # ⚠ WORK IN PROGRESS — SHOULD NOT BE SUBMITTED TO MAIN
>
> PRD/TDD for work still in validation. The product sections are firm; the
> technical design is deliberately partial, and says so where it is. What is
> built is a validation harness, not a shippable feature — read the Validation
> section before treating any number here as a result. Companions:
> `node_api_WIP.md` (the API), `magic_patch_WIP.md` (the delivery design),
> `magic_patch_test_plan_WIP.md` (manual validation).

# Magic Patch — automated migration of custom-node JS

## Executive summary

ComfyUI's frontend is being rebuilt: entity state moves into stores (ECS,
ADR 0008), rendering moves from canvas to DOM (Nodes 2.0). The surfaces custom
nodes are built on — prototype patching, `node.widgets` mutation, link
internals, `applyToGraph` — do not survive that. **Measured across the registry:
2,673 of 4,983 packs (54%) reach the frontend at all, and 4,349 JS files in 537
packs use surfaces that are changing.**

Left alone this forces a choice between breaking half the ecosystem and never
finishing the migration. Asking thousands of unpaid authors to each rewrite
against a new API is not a plan; it is a hope.

Magic Patch is the third option: **generate the migration offline, verify it by
running it, and ship the result as data.** An agent converts a pack against a
published API, a harness loads the pack before and after and compares what it
does, and only conversions that survive that are kept. Nothing runs on a user's
machine; no model is invoked at runtime.

The bet is that the conversions are mechanical enough to generate and
consequential enough to be worth verifying properly.

**Status: the harness exists and runs; validation is in progress.**

What is built is not the product — it is the instrument for answering whether
the product is possible. Three questions are open, and the pipeline exists to
answer them:

1. **Is the published API sufficient?** Every refusal names a capability that
   does not exist. The refusal rate is the measurement.
2. **Can conversions be trusted?** Every accepted conversion is a claim that
   behaviour is preserved. The regressions caught are the measurement.
3. **Does it pay?** Generation is offline and cheap per file; the question is
   whether yield times ecosystem size beats the alternatives.

None is answered yet. Best verified run: 3 of 25 files in one pack, no
observable regression. That is an early reading of question 1, not a result.

## Goals

1. **Move packs off surfaces we intend to delete.** Success is that the old
   surface becomes _deletable_, not that the pack keeps working — a shim would
   achieve the second and defeat the first.
2. **Never change what a workflow means.** The saved workflow and the queued
   prompt must be byte-identical before and after. This is the one hard
   invariant.
3. **Verify by execution, not inspection.** A conversion is not accepted
   because it looks right.
4. **Produce a reviewable artifact.** A unified diff and a `v1/` tree the pack's
   author could merge, not an opaque blob.
5. **Feed the API.** Every refusal names a missing capability; that list is the
   API's work queue.
6. **Be visibly ours.** A patched node is marked in the UI and its patch is
   inspectable. We wrote the change, so the user must be able to see that
   before they blame the pack's author.

## Non-goals

- **Not a runtime code generator.** Patches are generated in CI and shipped as
  data. No model runs on a user's machine, no API key is needed at runtime.
- **Not for core nodes.** Custom packs only.
- **Not for cloud.** Node/Electron only.
- **Not a compatibility layer.** No shims, no polyfills, no dual-path code.
- **Not automatic for everything.** Packs that genuinely cannot be expressed in
  the new model are refused and routed to their author.
- **Not node substitution.** Replacing an unmaintained pack with a core
  equivalent is a separate feature; the design leaves room for it.

## General description

Four pieces, each independently useful:

**1. The published API** (`src/platform/nodeApi/`) — closed, id-backed proxy
handles. No internal object is reachable; a handle survives its entity's
deletion and reports `isDeleted`. Conforms to the extension-v2 contract from
PR #11251 so the ecosystem gets one surface, not two. **20 capabilities, 161
members.**

**2. The conversion pipeline** (`scripts/magic-patch/`) — a lead agent reads a
whole pack, converts one file to establish the pattern, then briefs converter
subagents on files grouped by shared contract. Agents edit a `v1/` tree in place
with `Edit`; the pack as shipped sits beside it for reference.

**3. Verification** — `verify_pack` loads a pack twice, as shipped and as
converted, in separate processes, and compares: does it load, which types
register, which construct, and the serialised wire per type. Only _changes_ are
reported, so a pack that was already broken is not blamed on the conversion.

**4. The patch database** — `db/<pack>/<commit7>/` holds the pack; `v1/` inside
it holds the upgraded code. `compile_db` inverts this into an artifact keyed by
**source content hash**, so a patch can only ever apply to the exact bytes it
was verified against.

### Delivery

Three sinks from one generator:

- **A — upstream PR.** For packs whose authors accept them: the `v1/` folder as
  a pull request. Best outcome; the author owns the result.
- **B — shipped manifest.** Hash-keyed patches applied at load time for packs
  that will not be updated.
- **C — replacement mapping.** Future: substitute a core node entirely.

### What may ship

A conversion that was _written_ and one that was _run_ are different artifacts,
and the difference is invisible in the diff. Every entry therefore carries a
validation tier, and `compile_db` refuses anything below `harness`:

| Tier        | Means                                                           | Ships |
| ----------- | --------------------------------------------------------------- | ----- |
| `none`      | Written; static checks only. Never executed.                    | No    |
| `harness`   | Loaded before and after; types, construction and wire compared. | No    |
| `validated` | A **named human** drove it in a real ComfyUI and says it works. | Yes   |

An entry carrying no tier is treated as `none`. Absent evidence is not weak
evidence — an unstamped entry has never been run, and the field's absence must
not excuse it from the check that would have condemned it. `verify_db` stamps
the tier as a side effect of running, so the tier cannot drift from the evidence:
there is no way to claim `harness` except by passing the harness.

`--allow-unvalidated` exists for local iteration and warns loudly. CI does not
pass it.

_This gate found its first defect immediately:_ all three patches in the DB were
`none`, and the previous `compile_db` shipped every one of them without comment.

## Validation

**This POC is the validation harness.** It is not a deliverable being
validated; it is how the migration hypothesis gets tested. The hypothesis:

> An agent, given a sufficient published API and a skill describing the
> mappings, can convert the ecosystem's custom-node JS off the surfaces we
> intend to delete, and a harness can prove the conversions safe well enough to
> ship them.

Nothing here decides that yet. What follows is the reading so far.

### What the instrument has established

| Claim                                   | Evidence                                                       |
| --------------------------------------- | -------------------------------------------------------------- |
| An agent can convert real pack files    | 3 files in kjnodes, from 25                                    |
| Conversions can be behaviour-preserving | `EQUIVALENT` over 39 node types                                |
| Verification catches real regressions   | Caught two that every static check passed                      |
| Small diffs are achievable              | 272-line file converted with an 8-line diff                    |
| Refusals are accurate and specific      | Punts name exact missing capabilities, confirmed by inspection |

### What it has not

- **Yield is 3 of 25** on the one pack driven to completion — an early reading
  of API sufficiency, on a pack that turned out to be unusually canvas-heavy.
- **One pack, one model, one corpus.** No breadth. kjnodes may be atypical in
  either direction.
- **Nothing has run in a real ComfyUI.** Every result is from the harness, and
  the harness is itself unvalidated against reality. This is the largest hole:
  `EQUIVALENT` currently means "the harness saw nothing change", and nobody has
  checked the harness sees what matters.
- **No pack converted whole.** Partial conversion leaves the old surface in
  place, so goal 1 is unmet everywhere so far.
- **One run in five completed.** The rest died on expired auth, a stall, or a
  prompt bug — fixed, but not proven over a long run.

### What would end validation

Validation is done when these are answerable with evidence, not opinion:

| Question                             | Signal                                                                                                                                | Where it stands                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Is the API sufficient?               | Refusal rate across a representative sample stabilises, and residual refusals are things that genuinely cannot exist in the new model | 11 gaps open, enumerated; sample is one pack |
| Is the harness trustworthy?          | A manually-tested pack agrees with the harness verdict — and any disagreement becomes a check                                         | Not started; test plan written               |
| Are conversions safe enough to ship? | A converted pack runs in real ComfyUI, both renderers, byte-identical save/reload, alongside unconverted packs                        | Not started                                  |
| Does it scale?                       | A run over the download-weighted top band completes without hand-holding                                                              | Not started; longest clean run is one pack   |
| Would authors accept them?           | A PR opened against a real pack is merged                                                                                             | Not started                                  |

The first two gate the rest. Until a human has driven a converted pack in
ComfyUI and agreed with the harness, every `EQUIVALENT` is a claim about the
harness rather than about the pack.

### The failure that best characterises the state

The most recent run converted `fast_preview.js` and emitted:

```js
node.setSize({ width: 550, height: 550 }) // the API takes a tuple: [w, h]
```

Array-destructuring an object throws, so every node in the pack failed to
construct — **40 types lost from one line**. The agent had the full API
declarations in its working copy and still got the shape wrong.

Three things follow, and they are the shape of the whole project:

1. **Verification earned its place.** Every static check passed this. Only
   running the pack caught it.
2. **Documentation is not a control.** Shipping types reduced this class of
   error but did not eliminate it. Anything that must not happen needs a check,
   not a paragraph.
3. **The failure mode is silent and total.** One bad line takes out a whole
   pack, which is why the conservative posture — refuse rather than guess — is
   correct even though it costs yield.

### The gap list

`gap_inventory` scans the corpus statically and maps every legacy construct to
its destination or to nothing. Across 400 packs / 664 files:

| Gap                        | Packs blocked |
| -------------------------- | ------------- |
| ContextMenu / slot menu    | 36            |
| `api.fetchApi`             | 36            |
| pointer gestures on canvas | 27            |
| `queuePrompt`              | 19            |
| `app.extensionManager`     | 18            |
| settings get/set           | 14            |
| `LGraphCanvas` internals   | 13            |
| `graphToPrompt`            | 12            |
| `onConnectInput` (veto)    | 3             |

Closed so far: `defs.extend`, `defs.define` + `resolve`, `widgets.mount`,
`widgets.canvas`, `onPreview`, `onSerialize`, `setSizeConstraints`,
`slots.dynamic`, `graph.selection`, serialization control.

**The loop is: inventory → close the top gaps → rerun → re-inventory**, until
refusals are only things that genuinely cannot be expressed.

## Testing

**Unit — 347 tests.** The API's own behaviour, the conversion rules, the
verification harness.

**Conformance — 13 checks per converted file.** Static properties a conversion
must have: the old surface is retired, no invented API members, no writes that
silently vanish, handle state through accessors, nothing dropped without
account, no net-new capabilities, diff is mostly substance.

Each check exists because something got through: `handles-use-accessors` was
added after property writes took down 39 node types.

**Execution — `verify_db`.** The load/register/construct/serialise comparison.
Its limits are known and stated: it drives node lifecycle only, never clicks,
never renders, and **never calls a converted file's exported helpers**.

**Manual — the test plan.** Covers what the harness cannot: both renderers,
interaction, teardown, byte-identical save/reload, and coexistence with
unconverted packs. Every manual failure is recorded with _"could a check have
caught this?"_, so the plan shrinks over time.

## Risks

| Risk                                                            | Severity | Mitigation                                                                                         | Residual                                                                     |
| --------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **A conversion changes what a workflow means**                  | Critical | Wire comparison before/after; reserved serialization keys a pack cannot write                      | Comparison covers types the harness can construct                            |
| **A silent partial conversion** — looks converted, does nothing | High     | `retires-the-old-surface`, `no-silently-dropped-writes`, `mark_complete` refuses an unchanged file | Novel silent shapes need new checks; each has been found by inspection first |
| **API drift** — docs claim more or less than the code           | High     | Capability list generated; `.d.ts` shipped into every working copy; drift test                     | Has caused two large misfires; the class is closed, instances may recur      |
| **Cross-file breakage** from parallel agents                    | Medium   | Stranded-caller guard; whole-pack verification over merged output                                  | An agent can still break a caller it does not own                            |
| **Verification over-claims**                                    | Medium   | `EQUIVALENT` documented as "nothing observable got worse"                                          | Files whose exports are never called are barely verified                     |
| **Cost**                                                        | Medium   | ~99.5% of runtime is model time; in-place editing cut generation sharply                           | 4,349 files is days of model time                                            |
| **Author rejection of PRs**                                     | Medium   | Minimal-diff policy, surgical edits, no restructuring                                              | A pack may still decline                                                     |
| **Patch applies to wrong bytes**                                | Low      | Content-hash keying; strict diff applier that refuses fuzzy matches                                | —                                                                            |

## Rollout

**The patcher is a tool, not a plan.** It converts pack JS from the ad-hoc API to
V1. It has no opinion about who runs it, on which packs, or when — those are
decisions of the rollout, and keeping them out of the tool is what lets the same
binary serve all three paths below.

The rollout announces two things together: **ECS / Nodes 2.0 is the supported
graph for the frontend**, and **auto-patch is the primary tool for moving old
packs onto it**.

### Three paths, by who runs the patcher

| Path                | Who runs it                      | Coverage                      | Who owns defects |
| ------------------- | -------------------------------- | ----------------------------- | ---------------- |
| **Maintainer**      | The pack's author, with our help | Any pack whose author engages | The author       |
| **Comfy backstop**  | Comfy, in CI                     | Top 80% of packs by usage     | **Comfy**        |
| **User self-serve** | The user, locally                | The long tail                 | Nobody           |

**Maintainer-led is the preferred outcome, and we bend over backwards for it.**
We engage active maintainers, help them produce a V1 version of their pack,
discuss and vet the result. A pack the maintainer has moved to V1 **is not
patched** — their release wins, and the marking drops away because the code is
theirs again.

**The Comfy backstop exists so users are not the ones discovering breakage.** We
auto-patch and verify the top 80% by usage. We reserve the right to patch again
later if the API changes underneath a pack: the commitment is to the end user and
to ComfyUI "just working", not to a one-time conversion.

**The long tail gets the tool rather than the patches.** We may ship patches for
individual critical packs at our discretion, but the general answer is that
auto-patch is available to users as an end-user tool for patching whatever they
happen to run. **No guarantee it works.** It is offered because an unmaintained
pack's alternative is not working at all.

**A small set will not be patchable** — packs whose design conflicts with how the
frontend works now. We keep that list small and aim to provide the functionality
by another route rather than leaving a hole.

### Who owns a defect

- **Comfy-patched** — the patch set we generate _and verify_. **We own the bugs.**
  The node is marked `COMFY-PATCHED` in the UI, and the marking says who to
  contact when it breaks. A user must never file our change against the author.
- **User-patched** — a patch the user generated locally. **Neither Comfy nor the
  maintainer is responsible.** If patching fails and no maintainer is porting the
  pack, rewriting it by hand is the remaining option. Saying so plainly up front
  is kinder than implying a support path that does not exist.

Marking therefore carries **two independent facts**: who patched it, and how well
it was checked. Either alone would mislead — a verified user patch is still
unsupported, and an unverified Comfy patch is still ours.

### Unpatching

**Any patched pack can be unpatched**, restoring the code as its author shipped
it. We patch because the pack is broken against the current frontend, so
unpatching will often stop it working — that is the user's call to make, and
refusing to offer it would make the patch feel like something done _to_ them
rather than _for_ them.

### What this changes about the design

The user self-serve path means **the patcher runs on user machines**, which
earlier drafts of this document ruled out. Local generation needs a model the
user supplies or a hosted endpoint, and it cannot assume CI's corpus or its
verification harness — so a user-generated patch is `validation: none` by
construction, and the badge must say so. **Open: which of the three model
backends serves this path.**

## Deployment and operations

_Partial by intent — this is the least-developed section, and shipping is
gated on yield rather than on deployment work._

**Generation** runs in CI for the Comfy backstop, and locally for user
self-serve. Inputs: the registry corpus and
a Claude Code session. Outputs: `db/` entries and a compiled artifact. Auth is
probed before any work is spawned, after four batches were lost to expired
tokens.

**Distribution** is undecided. `magic_patch_WIP.md` §4 works through service
worker, blob URL and on-disk delivery; each has problems, and the choice
interacts with Electron's filesystem constraints. **Open.**

**Operation** is off by default, config-gated, silent, with one toast reporting
a count. A patch is applied only when the source hash matches exactly;
otherwise the original loads untouched.

**Rollback** is inherent: patches are data, so disabling the setting or shipping
an empty manifest restores original behaviour with no code change.

**Monitoring** is unspecified. At minimum: how many patches applied, how many
skipped on hash mismatch, and any error attributable to a patched file. **Open.**

**Ownership: Comfy owns the patch.** _(Decided 2026-08-06.)_ We wrote it, so a
defect in a patched pack is ours, not the author's. Two things follow, and both
are requirements rather than nice-to-haves:

- **A patched node is visibly marked in the UI** — a badge, symbol or border
  distinguishing it from an unpatched one. A user hitting a problem must be able
  to see that we changed this node before they file it against the author, and
  an author receiving a report must be able to ask "was it patched?". The mark
  carries the validation tier, because a badge that cannot tell `harness` from
  `manual` would claim more than the patch earned — and under the rule above,
  nothing weaker than `harness` reaches a user to be marked at all.
- **Patch provenance is inspectable** — which patch, generated when, against
  which source hash. A bug report about a patched node is only actionable if the
  exact conversion can be recovered.

This also sharpens the preference for sink A: a merged upstream PR transfers
both the code and the ownership, and the marking can drop away because the
author's own release now contains it.
