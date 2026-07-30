# Round 9 findings — consolidated

Target: round 7+8 delta on PR B (`2e9566b8ab..HEAD`).
18 lanes dispatched. Each item below is verified by the coordinator against
source, not relayed.

---

## H1 [BLOCKER-adjacent, treat as must-fix] — F4 deduplicated the classifier but left the input assembly duplicated

**Lane: drjkl. Verified by coordinator — the two literals are byte-identical.**

`useErrorGroups.ts:247-256`:

```ts
const errorSeverity = computed(() =>
  classifyErrorSeverity({
    promptError: executionErrorStore.lastPromptError,
    executionError: executionErrorStore.lastExecutionError,
    nodeErrors: executionErrorStore.surfacedNodeErrors,
    missingModels: missingModelStore.missingModelCandidates,
    missingMedia: missingMediaStore.missingMediaCandidates,
    hasMissingNodes: missingNodesStore.hasMissingNodes
  })
)
```

`useHasBlockingError.ts:18-26` is the same six-field literal over the same four
stores, ending in `.hasBlockingError`.

Why this matters more than it looks: F4 existed because red-vs-amber was computed
twice and could diverge. It is now _classified_ once but _assembled_ twice. Add a
seventh input, forget one site, and the panel content and the tab-icon gate
(`RightSidePanel.vue:181`) disagree again — the identical failure, one level up.
The consistency test that would have caught it was deleted in round 7 as
tautological, correctly, which removes the net that was masking this.

Fix: one composable gathers and classifies; `useHasBlockingError` narrows it.

```ts
export function useHasBlockingError() {
  const errorSeverity = useErrorSeverity()
  return computed(() => errorSeverity.value.hasBlockingError)
}
```

All four stores are already instantiated in `useErrorGroups`, so extraction adds
no lookups.

---

## H2 [NIT] — the `v-if` on the `#nodes` slot guards nothing

**Lane: drjkl, proved experimentally.** They mounted a bare `i18n-t` with
`keypath` = `errorsSummary` (`'{count} error | {count} errors'`) and passed an
unreferenced `#nodes` slot holding `undefined`. Output was exactly
`<span>3 errors</span>` — vue-i18n discards slots the resolved message does not
name, no warning.

The file's own idiom proves it two lines up: `ErrorGroupList.vue:105`'s
`<template #node>` is **unconditional** and is referenced by only 2 of the 7
keypaths.

This collapses together with H3 into one edit.

## H3 [NIT] — `...(errorNodeCount.value > 0 && { nodes: ... })` spreads a boolean

`ErrorGroupList.vue:580`. Legal (`{...false}` is a no-op) but the least direct
spelling. Since H2 shows the optionality buys nothing, make `ContextStrip.nodes`
a **required** `number` and populate it on every branch — that deletes the `?`,
the boolean spread and the `v-if` in one move.

## H4 [NIT] — `keypathIndex` re-introduces the ternary it claimed to remove

`ErrorGroupList.vue:575`:

```ts
const keypathIndex =
  errorNodeCount.value === 0 ? 0 : errorNodeCount.value === 1 ? 1 : 2
```

The dedup is real and should stay, but the reader now has to count array
positions in `SUMMARY_KEYPATHS` to learn that `2` means plural. Key the table by
name (`none` / `single` / `multiple`) instead of position — same win, no
counting, and it gives H5's comment somewhere natural to live.

## H5 [NIT] — real domain knowledge was lost with a deleted comment

**Found independently by the coordinator and by drjkl.**

G3 deleted `// Node-less errors (e.g. prompt-level) would read as "0 nodes"`.
What survives is `errorsSummary` sitting at index `0`. A reader can infer _what_
but not _why a count of zero located nodes is reachable at all_ — that
prompt-level errors have no node to attribute. F3 spent a blocker establishing
that this branch matters, and the mixed branch at `:563` now carries the same
`=== 0` check with no explanation either. Both call sites are unexplained.

AGENTS.md protects exactly this class of "why" comment. Restore it, folded into
the `SUMMARY_KEYPATHS` doc comment.

## H6 [NIT] — inferred return type on the module's public contract

`errorSeverityClassification.ts:24`. Not a typecheck hazard today. But
`hasBlockingError` is the one field in this PR that decides amber-vs-red, and an
inferred return type gives a future edit no declaration site to review against.
The nested element shape (`{ rawNodeId, nodeId, nodeError, errors: {error,
absorption}[] }`) is what `processNodeErrors` walks and has no name. Name the
result and the node entry; annotate the function.

## H7 [NIT] — half the `| undefined` unions have no supplier

`errorSeverityClassification.ts:16-20`. drjkl traced all three call sites:
`lastPromptError`/`lastExecutionError` are `ref<T | null>`, `surfacedNodeErrors`
resolves to `Record<...> | null`, both candidate lists are `ref<T[] | null>`, and
the test helper passes `null` for all five. Nobody passes `undefined`.

For `promptError`, `missingModels`, `missingMedia` the `| undefined` mirrors the
pre-existing callee signatures in `missingResourceAbsorption.ts` — defensible
pass-through. For `executionError` and `nodeErrors` it mirrors nothing. Narrow
those two.

---

## Clean lanes

- **drjkl, banned constructs**: zero hits across the delta for `any`, `as any`,
  `as unknown as`, `@ts-expect-error`, non-null assertions, `dark:`,
  `!important`, `:class="[...]"` merges, arbitrary percentage utilities. The one
  new class string uses semantic tokens and `size-*` correctly.

---

## H1 — CORROBORATED

Also raised independently by the architecture lane, which reached the identical
conclusion and the identical fix. **2 lanes.** Treat as must-fix.

---

## H8 [MUST-FIX] — the mixed zero-node strip counts amber items as errors

**Lane: architecture-reviewer. Verified in source by the coordinator.**

`ErrorGroupList.vue:539-541`:

```ts
const workflowErrorCount = computed(() =>
  allErrorGroups.value.reduce((sum, group) => sum + group.count, 0)
)
```

Sums **every** group regardless of severity. The F3 branch then feeds it into
`rightSidePanel.errorsSummary` = `"{count} error | {count} errors"`.

So in the mixed + zero-located-nodes state the strip promotes warning-severity
items to "error" in exactly the state where the panel is trying to teach the user
the difference. The delta's own test pins the wrong behaviour —
`TabErrors.test.ts:528-541` sets one `prompt_no_outputs` plus one string-only
missing node type and asserts the strip reads **`2 errors`**, while the heroes
immediately above read `1 Error detected` and `1 Setup pending`.

Every sibling branch is severity-honest: the single-severity fall-through is
unreachable when both severities are present, so its all-groups sum is
coincidentally correct; the mixed non-zero-node branch uses the neutral
`nodesAffected`. Only the mixed zero case is dishonest.

It over-states rather than under-states severity, so it is **not** a blocker
under this round's organising principle — but it contradicts the PR's own premise
and a test locks it in.

Fix: count only blocking groups in that branch. Unfiltered, matching the strip's
existing workflow-wide contract:

```ts
const workflowBlockingErrorCount = computed(() =>
  allErrorGroups.value
    .filter((group) => group.severity === 'error')
    .reduce((sum, group) => sum + group.count, 0)
)
```

Update `TabErrors.test.ts:528-541` to expect `1 error`, matching the red hero.
No new i18n key needed.

---

## H9 [NIT] — `hasBlockingNodeError`'s first disjunct is dead

**Lane: complexity. Verified by the coordinator.**

`errorSeverityClassification.ts:51-58` assigns `absorption: null` to **every**
error of a node when `nodeId === null`. So at `:66`:

```ts
;(nodeId === null && errors.length > 0) ||
  errors.some(({ absorption }) => absorption === null)
```

the first clause is true only when the second is also true. `tryNormalizeNodeExecutionId`
returns `NodeExecutionId | null`, so there is no third state that separates them.
No test distinguishes the two spellings — there is no unnormalisable _node-error_
case in `errorSeverityClassification.test.ts` at all, only the execution-error one.

The fail-safe behaviour I demanded in round 7 is correct and preserved; it lives
in the map's `: null` branch. The redundant clause reads as if it is doing work.

**Coordinator decision:** drop the redundant disjunct and let the map be the sole
authority. The resulting pair of statements is the honest formulation — "an error
on an unkeyable node is never absorbed" and "a node error is blocking if any of
its errors was not absorbed" — and each is locally clear. Do **not** add a
comment explaining the removal.

Also change `absorption === null` to `!absorption`. Per this round's principle an
`undefined` must not read as absorbed. The declared return type rules it out
today, so this is cheap insurance, not a bug fix.

While you are there: add the missing test — a node error whose `rawNodeId` does
not normalise must classify as blocking.

## H10 — complexity's second finding is superseded

The complexity lane also observed that the mixed zero-node branch returns an
object byte-identical to the fall-through, and proposed hoisting
`errorNodeCount > 0` into the guard. That reading is correct **today**, but H8's
fix makes the two branches genuinely different (blocking-only count vs
all-severity count), so the duplication disappears as a side effect. Implement H8;
do not also hoist the guard.

---

## Clean lanes (verified, not merely asserted)

- **adr-compliance — NO FINDINGS.** Quoted ADR 0008:222 permitting store-internal
  imperative writes ("internal mutation is imperative, while the public API is
  action-based"); confirmed the delta _reduced_ the imperative surface by deleting
  an exported action and its two call sites. Confirmed `executionErrorStore` →
  `missingNodesErrorStore` is a pre-existing edge (already used at `:58`, `:416`,
  `:461`, `:111`), so the delta adds a reactive edge over an existing one and does
  not duplicate authority. No litegraph/ECS/`graph._version` contact; no entity
  callback changed; the removed action was never extension-visible because
  `comfyAPIPlugin` only shims `src/extensions/core` and `src/scripts`. Also
  established that the component→`core/graph` import violates no configured rule
  — `eslint.config.ts:366-396` scopes layer zones to `base`/`platform`/`workbench`
  only — and has dense precedent in sibling component directories.

---

## H9 — CORROBORATED

Also found independently by the dx-readability lane, with the same proof. **2 lanes.**

## H4 — STRENGTHENED with a concrete fragility

dx-readability identified the unstated invariant that makes the positional tuple
actually dangerous rather than merely opaque:

> position 0 of each tuple must be the **only** member lacking a `{nodes}`
> placeholder — true today (`main.json:4073-4075`, `4079-4081`) — because the
> `nodes` slot only renders when `strip.nodes !== undefined`. Reorder either
> tuple and a `{nodes}` placeholder renders with no value.

So H4 is not a taste preference: the keyed-object fix converts a positional
invariant that nothing enforces into a structural one. Do it.

## H11 [NIT] — `ContextStrip.count` changes referent between branches

**Lane: dx-readability.**

`count` is the error count in three branches and the **affected-node** count in
the mixed non-zero branch (`:566-569` feeds `errorNodeCount` into `count` for
`nodesAffected` = `"{count} node affected"`). Output is correct in all four
branches; the trap is for whoever adds a fifth.

Since `count` is really "the numeral vue-i18n pluralises on", either rename it to
say so or give `ContextStrip` a one-line doc. Prefer the doc — a rename touches
every branch and the template.

## H6 — STRENGTHENED, and now includes a rename

dx-readability's framing is better than mine. The problem is not only the missing
return type: `classifyErrorSeverity` is **named for its smallest output**. Three
of its four returned fields are the panel's primary rendering data —
`processNodeErrors` builds every execution group from `errorSeverity.value.nodeErrors`
(`useErrorGroups.ts:429`) and reads `class_type` off it (`:433`);
`processExecutionError` takes its normalised `nodeId` from
`errorSeverity.value.executionError` (`:478-481`). Someone looking for "where do
the rendered node errors come from" will not open a file named
`errorSeverityClassification.ts`.

Rename the function to cover its whole output and declare a named exported return
type beside `ErrorSeverityInput`. Keep the module filename — renaming the file
churns imports for no gain, and `hasBlockingError` is still its headline output.

---

## Clean lanes (continued)

- **accessibility — NO FINDINGS.** Verified `role="status"` sits on the _stable_
  strip wrapper (`ErrorGroupList.vue:87-91`) while the `v-if`/keypath churn
  happens on the `i18n-t` child, so every severity-state text change is announced
  from a persisting live region; the delta neither added nor moved that attribute.
  Enumerated all nine reachable keypaths and confirmed the three that omit `nodes`
  are exactly the three whose English strings lack `{nodes}`, and that the spread
  guard and `keypathIndex` share the same `errorNodeCount` predicate so they
  cannot desynchronise. Confirmed the blocked marker's accessible name is
  group-type agnostic, that its dot is `aria-hidden` and paired with literal text
  (1.4.1 satisfied by text, not colour), and that the delta adds only
  non-focusable spans so tab order and accessible names are unchanged.

- **dx-readability, comment policy — clean.** Chased two candidates for
  "non-obvious invariant with no comment" and rejected both because each is
  already pinned by a test _name_: G1's case-sensitivity by
  `missingResourceAbsorption.test.ts:154` (`does not absorb a differently-cased
missing candidate`) and F2b's undo behaviour by
  `useErrorClearingHooks.test.ts:543` (`keeps the missing-node prompt while undo
removes its node during graph loading`). Both tests exist and are well named —
  independent confirmation that rounds 7 and 8 landed the coverage they claimed.

- **dx-readability, dead code — none.** All three non-severity fields of the
  classifier result are consumed (`useErrorGroups.ts:385`, `:429`, `:478`), as are
  the inner `rawNodeId` (`:430`, `:463`) and `isAbsorbed` (`:392`).

- **dx-readability on the double `getLiftedErrorSource` call — explicitly not a
  finding.** The two call sites read disjoint fields, and hoisting would force
  both predicates to take a `liftedSource` parameter alongside `error` — two
  arguments that must stay in sync. Leave it. (This closes a question I raised in
  the round 9 brief.)

---

## Worktree hygiene note

`__probe_f1.test.ts` and `__probe_f1b.test.ts` are present but **untracked**, and
`HEAD` is unchanged at `f66a146e15` with no tracked file modified. They are the
austin lane's in-flight F1 probes, not committed artifacts. The accessibility lane
inferred they were tracked by reasoning from the session-start status; that
inference was wrong. Coordinator will remove them once that lane finishes.

---

## C1 [COORDINATOR ACTION, not a Codex item] — remove the round-9 probe files before dispatching

**Lane: pattern-compliance, filed as two blockers. Correct, and mine to fix.**

`__probe_f1.test.ts` and `__probe_f1b.test.ts` match the unit-test glob
`src/**/*.test.ts`, so `pnpm test:unit` collects them **now**. They contain a
`writeFileSync` to a hardcoded path holding this session's scratchpad UUID
(`__probe_f1.test.ts:88`) and a `process.env.PROBE_OUT!` (`__probe_f1b.test.ts:105`),
both of which throw `ENOENT` anywhere else. `__probe_f1b`'s `it()` body never
asserts — it is a data dump.

They are untracked, so they cannot reach the PR, but they would break the gate run
for the round-10 fix. Coordinator deletes them once the austin lane finishes with
them. Do not put this in the Codex contract.

## Process note recorded, and it cost a lane its confidence

pattern-compliance's first read of `missingResourceAbsorption.ts` caught it
mid-mutation, with `matchesErrorInputName` reduced to
`const errorInputNames = [error.extra_info?.input_name]` plus `void liftedSource` —
i.e. exactly the F1 mutation-proof. It re-read, found the file restored, and said
so rather than filing the fabricated blocker. Two lanes (this one and drjkl) hit
the same window.

Lesson for the next round: a mutation-probing lane and read-only lanes must not
share a worktree. Give the probing lane `isolation: worktree` next time.

---

## Clean lanes (continued)

- **vue-patterns — NO FINDINGS**, and it established something important that
  nobody asked for: **`flush: 'sync'` is load-bearing, not incidental.**
  `app.ts` calls `rescanAndSurfaceMissingNodes` (`:1851`) and `recordPromptError`
  (`:1904`) in one synchronous block with no `await` between. In the desync case —
  backend rejects with `missing_node_type`, frontend rescan finds nothing — line
  1851 flips `hasMissingNodes` true→false. Under the default `'pre'` flush the
  callback would queue and run _after_ 1904, wiping a freshly recorded, genuinely
  blocking prompt error, and the panel would show **nothing** for a failed run.
  `'sync'` fires while `lastPromptError` still holds the old (already-null) value,
  so the new error survives as an unabsorbed blocking group.

  This is the desync protection regression-risk was asked to verify survived the
  F2 rewrite. It did, by a different mechanism than the old `hadMissingNodes`
  parameter — and if anyone later "tidies" `flush: 'sync'` away, the desync red
  card disappears. **Add this to the round-10 contract as a comment worth having**
  (a genuine non-obvious why), and confirm a test pins it.

  Also confirmed: no leak (Pinia setup body runs in the store's own `EffectScope`,
  stopped by `$dispose()`; created once per pinia instance, not per consumer); a
  derived `computed` would be _wrong_ here rather than merely different, because
  it is reversible — if missing nodes reappear, a stale `missing_node_type` prompt
  error would resurrect and be re-absorbed with `blockedLastRun` set for a run
  that never happened; the conditional named slot compiles to `createSlots` with
  the `DYNAMIC_SLOTS` patch flag, which is the documented pattern, not a
  workaround.

  It also closed the one hazard I would have raised myself: the watcher is
  edge-triggered on a boolean while its guard is imperative, so a suppressed
  transition is never retried. Every path is closed — `clean !== false` loads call
  `clearAllErrors()` (nulling the prompt error at `:109`) _before_
  `isLoadingGraph = true`, and undo/redo replays the cached type set via
  `workflowService.ts:609` so `hasMissingNodes` never actually changes. Watching
  the boolean rather than the array is what makes that replay a no-op.

- **pattern-compliance — no convention violations in the delta.** Notable
  verifications rather than assertions: oxfmt's `sortImports` is **disabled by
  default** and `.oxfmtrc.json` does not enable it, and no `import-x/order` /
  `simple-import-sort` / `perfectionist` rule exists in `eslint.config.ts` — so
  AGENTS.md's "sorted/grouped by plugin" is unenforced and the surrounding files
  break it everywhere. It explicitly declined to file the one deviating import
  line as a manufactured nit. Correct call; the round-8 formatting commit was
  about width, not order.

  It also confirmed the i18n three-key lookup is **correct** use of the plural
  system, not the forbidden hand-rolled pluralization: vue-i18n supports one
  plural axis per message, `count` uses it inside each key, and `nodes` must
  therefore be a keypath choice. `errorNodeSummary` and `errorNodesSummary` are
  distinct messages, not forms of one. This closes the question I raised in the
  brief.

---

## H12 [MUST-FIX] — the unnormalizable `nodeErrors` key path has no test at any level

**Lane: test-quality.**

`errorSeverityClassification.ts:64-68` carries an explicit blocking disjunct for
it and `useErrorGroups.ts:461-466` has a matching
`addUnlocatedErrorToGroup(groupsMap, \`node-${rawNodeId}\`, ...)`branch. **Nothing
exercises either.** Repo-wide,`not::a-node`appears only as an`executionError.node_id`(three tests); every`recordNodeErrors` key in the lane
(`'1'`, `'2'`, `'10'`, `'1:20'`, `'10:11:99'`, `'2:5'`, `'12:5'`) normalizes.

Untested input:

```ts
nodeErrors: { 'not::a-node': nodeError([validationError('value_not_in_list', 'ckpt_name')]) }
```

should give `hasBlockingError: true` plus a card `id: 'node-not::a-node'` with
`nodeId` undefined.

This is the same axis F4 exists to protect — a blocking failure the panel could
silently drop or downgrade to amber — and it is the **only** one of F1/F2/F3/F4/G1
with a branch no test reaches. Named future regression: generalising
`useErrorGroups.ts:431`'s `if (filterBySelection && !nodeId) continue` to
`if (!nodeId) continue` would make the error vanish from the panel entirely with
all 3116 tests still green.

**This pairs with H9.** Once the dead disjunct is removed, the map's `: null` is
the sole authority for "unkeyable ⇒ never absorbed", and this test is what pins
it. Do H9 and H12 in the same commit.

Fix: one case in `errorSeverityClassification.test.ts` asserting `hasBlockingError`
is `true`; one in `useErrorGroups.test.ts` asserting the `node-<rawId>` unlocated
card is produced, mirroring `:666`.

## H13 [NIT] — three tests in `useErrorClearingHooks.test.ts` funnel into a no-op

**Lane: test-quality.** `:577` (delete unrelated node) and the two `it.for` cases
at `:597` (mute / bypass unrelated node) all seed **no** missing node types, so the
watcher source `() => !hasMissingNodes` is already `true` at construction and never
transitions — the callback never runs. All three then hit `removeMissingNodesByNodeId`,
which early-returns at `missingNodesErrorStore.ts:68`. Mute and bypass are collapsed
into one OR at `useErrorClearingHooks.ts:147` and that distinction is already covered
at `:1164`. All three assert the same line.

Keep `:577` and `:632` (the armed-but-not-emptied case, which is the one that
distinguishes behaviour). Drop the `it.for` block at `:597-630`.

## H14 [NIT] — remaining Tailwind assertions duplicate accessible-name assertions

**Lane: test-quality.** `RightSidePanel.vue:196-204` derives the glyph class _and_
the `aria-label` from the single `hasBlockingError` boolean, so in each of the four
tab-icon tests (`:863`, `:881`, `:903`, `:931`) the `toHaveClass(...)` line and the
`toHaveAccessibleName(...)` line on the next statement are two projections of one
value.

Sharper argument for `TabErrors.test.ts:492`: `text-charcoal-800` is the exact
token the round-9 out-of-scope list says a designer may replace with a
`--warning-foreground` semantic token. When they do, this test breaks with **no
behaviour change** — precisely what AGENTS.md's rule against style-dependent tests
exists to prevent.

Fix: delete `'text-charcoal-800'` from `:492` and the whole assertion at `:496`;
drop the four `toHaveClass` calls and keep their `toHaveAccessibleName` partners.
**Do not** touch the `error-section-count-badge` class assertions (`:257`, `:490`,
`:596`) — that badge exposes per-group severity through no other DOM handle.

---

## Resolved by verification, no action

- **`useNodeReplacement.test.ts`'s frozen mock is genuinely fixed.** test-quality
  confirmed the mock was **deleted** rather than made stateful; the store mock now
  exposes only `removeMissingNodesByType`, and surviving assertions check arguments
  derived from the real placeholder-matching loop. The transition it used to pretend
  to cover is now driven through **real** stores at `useErrorGroups.test.ts:1317`.
- **The `isLoadingGraph` guard is tested in both directions** — fires when not
  loading (`useErrorClearingHooks.test.ts:514`, `missingNodeScan.test.ts:109`),
  suppressed when loading (`:543`).
- **The Playwright spec genuinely pins the feature.** Typed via
  `satisfies Record<string, NodeError>`, page-scoped route mock with `times: 1`,
  retrying assertions only, no `waitForTimeout`, and it asserts
  `toHaveAccessibleName('Setup pending')` rather than a colour. Removing absorption
  would raise the `error-group-*` count 1→2 and reveal `errors-summary-hero-error`.
- **No geometry assertions, snapshots, order-dependent tests or unmocked services**
  anywhere in the lane. The removed fixed-height/padding and negative-class checks
  were not reintroduced.
- test-quality traced all eight production→test pins in a table and found **no
  vacuous test** in the delta.

---

## H15 [MUST-FIX] — the E2E asserts the downgrade but not the compensating signal

**Lane: playwright-e2e.**

Every assertion in the new spec is about _downgrading_: one card, amber hero,
non-red tab. Nothing asserts the signal that tells the user the run actually
failed. `processNodeErrors` returns `blockedMissingGroups` containing
`'missing_model'` for this exact input (`useErrorGroups.ts:436-440`), flowing into
`buildMissingModelGroups(...)` at `:885` and rendering
`data-testid="blocked-last-run-indicator"` (`ErrorGroupList.vue:128-129`).

If `blockedLastRun` regressed to `false` — **the exact field G2 just moved across
four union members into `ErrorGroupBase`** — this E2E still passes and the user
sees pure amber with no indication the run was blocked. That is the failure
direction this round exists to prevent, and the only reason it is a nit rather
than a blocker is that `TabErrors.test.ts:564` covers it at unit level.

Fix, one line inside the existing test — no new spec:

```ts
await expect(
  comfyPage.page
    .getByTestId(TestIds.dialogs.missingModelsGroup)
    .getByTestId('blocked-last-run-indicator')
).toBeVisible()
```

---

## Third lane hit the mutation window

playwright-e2e also read `matchesErrorInputName` mid-mutation (`void liftedSource`,
`input_name` only) and — correctly — declined to file it as out-of-lane while
flagging its existence. **Three lanes** (drjkl, pattern-compliance, playwright-e2e)
hit the same window. Coordinator has verified the file is correct at `HEAD`. The
worktree-isolation lesson stands.

## Clean, verified (playwright-e2e)

- The spec is **mutation-discriminating**: with absorption reverted, the error
  takes `addNodeErrorToGroup` (`useErrorGroups.ts:436-468`) producing a second
  `severity: 'error'` group, and all four assertions fail — count 1→2, the red hero
  becomes visible, and the tab `aria-label` flips to "Blocking errors".
- Two vacuity traps ruled out by source: the mocked
  `prompt_outputs_failed_validation` does **not** create a second group because
  `app.ts:1898-1906` records the prompt-level error only `if (!hasNodeError)`, so
  `count === 1` is correct rather than accidental; and nothing gates the POST
  client-side, so the mocked 400 is genuinely consumed.
- `NodeError` from `@/schemas/apiSchema` is the right authority
  (`zPromptResponse.node_errors = z.record(zNodeId, zNodeError)`), `extra_info` is
  `.passthrough()` so `received_value` typechecks under `satisfies`, no `as any`.
- Isolation correct: outer `beforeEach` runs `cleanupFakeModel` before the workflow
  loads; the route mock is page-scoped with `times: 1`; nothing needs cleanup.
- `@ui` tag correct; untagged-otherwise means chromium-only, which is right —
  the `cloud` project greps `/@cloud/` and the asset-browser path would change the
  presentation there.

---

## H8 — CORROBORATED (3 lanes) with a better reproduction

**human-review** reached it independently and supplied a more realistic input than
the architecture lane's: `prompt_no_outputs` plus one **workflow-level missing
model**. `MissingModelCandidate.nodeId` is documented optional — "Undefined for
workflow-level models not tied to a specific node" — so `errorNodeCount` is 0 and
the strip renders **"2 errors"** directly below a hero reading
`1 / Error detected / Resolve before running` and `1 / Setup pending`.

Use this input in the fix's test, not the string-only missing-node-type one — it
is a state a real user hits.

human-review's framing, which I am adopting for the contract: _F3 correctly stopped
the "0 nodes affected" reading, but resolved the ambiguity toward calling a warning
an error — the exact conflation this PR exists to undo._

## H2/H3 — CORROBORATED, and the proof is now from the repo itself

**human-review** produced a stronger proof than drjkl's synthetic mount: the
**pre-delta code at this same site** passed `nodes: 0` into `setupSummary`
(`"{count} item | {count} items"`, no `{nodes}`) while `TabErrors.test.ts:505`
asserted `'2 items'` and **passed at `2e9566b8ab`**. So this repo has already
demonstrated that `i18n-t` ignores a slot the resolved message does not name.

That settles it: the optional field, the conditional spread, and the template guard
are three pieces of machinery with no observable effect. Make `nodes` required.

---

## Structural questions CLOSED by verification (no action)

- **Do `hasBlockingError` and rendered severity stay aligned now that the agreement
  test is gone?** Yes, **by construction** — every `absorption === null` node error
  reaches `addNodeErrorToGroup`/`addUnlocatedErrorToGroup`, and both
  `toSortedGroups` (`:158`) and the classifier treat an unnormalisable `node_id` as
  blocking. This was my main open worry about F4. (human-review)
- **Is `errorSeverityClassification.test.ts` a re-derivation in a new guise?** No —
  every assertion is a literal `true`/`false`/`null` against constructed input, and
  the absorbed/unabsorbed pair (`ckpt_name` vs `other_widget`) fails in **both**
  directions, so neither a match-everything nor a match-nothing absorber survives.
- **Do the rewritten absorption tests discriminate F1 and G1?** Yes, with concrete
  proof: `liftValidationError('source_image', 'image', …)` yields
  `input_name: 'source_image'` / `source_input_name: 'image'`, which returns `null`
  under the old `widgetName === input_name` comparison; and
  `'SDXL/Model.safetensors'` vs `'sdxl/model.safetensors'` returns `null` only with
  `toLowerCase()` gone.
- **Is F2's guard placement right?** Yes. `rootGraph.configure()` (`app.ts:1400`)
  sits inside the `isLoadingGraph` window (1395/1558) and
  `graph.onNodeRemoved → removeNodeErrors` has no guard of its own, so undo/redo
  does empty the list under the flag; `showPendingWarnings` (`:1547`) restores it in
  the same window. The one unguarded flip — `app.clean()` → `clearAllErrors()` →
  `setMissingNodeTypes([])` at `:1247` — is harmless because `lastPromptError` is
  nulled two statements earlier in `clearAllErrors`, and both orderings agree.
- **Cross-file drift to `MobileError.vue` / `useErrorOverlayState`?** None. Both read
  only `count`/`displayMessage`/`errors`, and `ErrorNodeCard.vue:3,64,214` already
  guards on `card.nodeId` because the prompt card has always been nodeId-less. So
  `addUnlocatedErrorToGroup` reuses an established shape rather than introducing a
  new invariant. This closes the question I put in the brief.
- **Removing `expect(contextStrip).not.toHaveTextContent('5')`
  (`TabErrors.test.ts:790`) did not weaken coverage** — the positive
  `'4 nodes affected'` assertion still fails if the mixed branch regresses.

## Probe count is now three

`__probe_f1.test.ts`, `__probe_f1b.test.ts`, `__tmp_probe.test.ts` — all untracked.
Coordinator deletes all three before dispatching round 10.

---

# X1 [BLOCKER] — F1 made the two match axes a cross product, so one promoted candidate absorbs other interiors' blocking errors

**Lane: bug-hunter. Verified in source by the coordinator. This is a regression I
introduced by specifying F1 the way I did.**

**Round-11 correction.** The account below is valid for the lifted-error regression,
but its original generalisation was false. `error.extra_info.input_name` is a
boundary name only after lifting; for an unlifted error it remains an interior name.
The loose node-id gate admits a promoted model candidate through
`sourceExecutionId`, so the unconditional name branch can still cross namespaces.
That failure predates F1 and also survives the proposed `matchesErrorTargetPair`
below because its candidate-id set loses the correspondence between each name and
its own id.

Boundary names are not structurally unique either: `Subgraph.addInput` permits
duplicates, and the rename UI changes `label`, not `name`. The promotion path's
`nextUniqueName` suffixing is what distinguishes promoted boundary names. The
original renamed-boundary reproduction below was not reachable through the rename
UI; the no-rename, same-named-widget reproduction is the valid one.

`missingModelScan.ts:292-296` builds a promoted-model candidate as:

```ts
nodeId: target.executionId,                    // HOST exec id
...(target.sourceExecutionId && { sourceExecutionId: target.sourceExecutionId }),  // INTERIOR
widgetName: target.candidateWidgetName,        // HOST widget name (`widget.name`, :224)
```

`liftNodeErrorsToBoundary.ts:130-146` keys a lifted error at the **host** exec id
with `input_name` = host input name and `source_input_name` = interior input name.

So for any error lifted to host `12`:

- `errorNodeIds` = `[nodeId='12', source_execution_id='12:5']` — always contains `'12'`
- `candidateNodeIds` = `[sourceExecutionId='12:9', nodeId='12']` — also contains `'12'`

**The node-id check is a tautology across every promoted candidate under one host.**
Absorption then hinges solely on `candidate.widgetName` matching _either_ the host
input name _or_ **some other interior node's** input name — because the two axes are
tested independently rather than as coupled tuples.

For this lifted-error case, before F1 the cross-match could not happen: the
comparison was
`candidate.widgetName === error.extra_info?.input_name`, host-name against
host-name, coupled by the promotion path. F1 added the independent interior-name
axis and opened a cross-match.

## Reproduction (verified against source)

Subgraph host `12`, two `CheckpointLoaderSimple` interiors `12:5` and `12:7`, both
`ckpt_name` widgets promoted. `nextUniqueName` produces boundary names `ckpt_name`
and `ckpt_name_1` without a rename.

- Candidate A: `{ nodeId: '12', sourceExecutionId: '12:5',
widgetName: 'ckpt_name', name: 'missing.safetensors', isMissing: true }`.
- Interior `12:7` has value `None`, so it produces no candidate but does produce a
  genuine blocking `value_not_in_list` error.
- After lifting the sibling error is surfaced at `12` with
  `{ input_name: 'ckpt_name_1', source_execution_id: '12:7',
source_input_name: 'ckpt_name' }`.

`matchesMissingModel(A, E7, '12')`:

- `errorNodeIds = ['12','12:7']` ∩ `candidateNodeIds = ['12:5','12']` → `'12'` → passes
- the boundary-name comparison fails on `ckpt_name_1`, but the independent interior
  comparison accepts `A.widgetName = 'ckpt_name'` **via the interior name of a
  different node**

→ `absorption = 'missing_model'`. `useErrorGroups.ts:436-440` `continue`s, so the
error never renders; `errorSeverityClassification.ts:64-68` sees no
`absorption === null`, so `hasBlockingError` is `false`. The user sees only an amber
"Missing Models" card. Downloading that model does not fix `12:7` and the next run
fails identically.

Also fires **without any rename** whenever N same-named widgets are promoted (host
names `x`, `x_2`, `x_3`, all interior names `x`): the candidate for host `x` absorbs
every other promoted widget's lifted error.

Media candidates are immune — `missingMediaScan.ts:120` always uses the node's own
exec id and never sets `sourceExecutionId` (verified: no such field in that file),
so `candidateNodeIds` never contains the host id.

## Required fix

Round 10 fixed the delta-introduced cross-match by pairing only the interior-name
comparison with `source_execution_id`. The broader follow-up must fully couple each
candidate surface to its own corresponding id, rather than first merging the
candidate's host and source ids:

```ts
function matchesErrorTargetPair(
  candidateNodeId: string | number | null | undefined,
  candidateInputName: string,
  error: NodeValidationError,
  nodeId: NodeExecutionId
): boolean {
  const lifted = getLiftedErrorSource(error)
  const surfaces = [
    { id: String(nodeId), inputName: error.extra_info?.input_name },
    lifted && {
      id: lifted.source_execution_id,
      inputName: lifted.source_input_name
    }
  ]
  return surfaces.some(
    (surface) =>
      surface != null &&
      candidateNodeId != null &&
      String(candidateNodeId) === surface.id &&
      surface.inputName === candidateInputName
  )
}
```

The model call passes `candidate.nodeId`, which is the host id for a promoted model
whose `widgetName` is a boundary name. The media call also passes
`candidate.nodeId`, which is the interior id for its interior `widgetName`. Root
candidates pair naturally with the unlifted error surface. This preserves the
id/name correspondence that the union set discarded.

**Keep the existing loose `matchesErrorNodeId` gate and the `matchesReceivedValue`
fallback exactly as they are for the F1 fix. `received_value` is filename identity,
not full resource identity: it is folder-blind, so a `loras/` candidate can absorb a
`checkpoints/` error with the same filename. Leaving it untouched is still the right
scope decision because the defect is pre-existing and folder-aware matching is a
separate change, not because that absorption is correct. Change only the name axis:

```ts
if (!matchesErrorNodeId([...], error, nodeId)) return false
return (
  matchesErrorTargetPair(candidate.nodeId, candidate.widgetName, error, nodeId) ||
  matchesReceivedValue(error.extra_info?.received_value, candidate.name)
)
```

The singular candidate id is the essential difference from the round-9 proposal.
The shipped F1 fix remains intentionally narrower; this fully coupled form is
follow-up work for the pre-existing unlifted-error defect.

I checked the fix against all three cases myself:

- renamed **media** boundary (`source_image` over `image`, candidate keyed `12:5`,
  `widgetName='image'`) → matches on the source surface ✓
- suffixed **model** boundary (candidate `nodeId='12'`, `widgetName='ckpt_name_1'`) →
  matches on the host surface ✓
- the cross-match above → host surface fails on name, source surface fails on id →
  **no match** ✓

## Tests

Add the two-promoted-interiors case as a test, driving the real lifting code.
Mutation-proof it: with the coupled check reverted to the two independent
predicates, it must fail. Also keep a test for the N-same-named-widgets variant,
which needs no rename and is the more likely production shape.

---

## Cleared by bug-hunter (verified, no action)

- **`whenever` watcher** — does not fire at store creation (`whenever` forwards
  `immediate`, which is not passed); `recordPromptError` cannot run before the store
  exists; `clearAllErrors` nulls `lastPromptError` **before** `setMissingNodeTypes([])`
  so the sync fire is a no-op; `clean !== false` routes through `app.clean()` →
  `clearAllErrors()` at `app.ts:2410-2411` before `rootGraph.clear()`; undo/redo uses
  `clean: false` entirely inside the `isLoadingGraph` window with
  `showPendingWarnings` re-surfacing at `:1548` still inside it. **Every failure mode
  it could construct leaves a stale _red_ prompt error, never a downgrade.**
- **`normalizePath` after G1** — removing `.toLowerCase()` only tightens matching,
  i.e. errs toward blocking. The equal-after-normalise inputs (`'a//b'`/`'a/b'`,
  `'a/'`/`'a'`, `'/'`/`''`) are unreachable: model names must pass `isModelFileName`
  (`missingModelScan.ts:111-114`) and media names `value.trim()`
  (`missingMediaScan.ts:100`), so none can be `''`, `'/'` or slash-terminated.
  Windows drive letters never appear in combo values. **Q1 is now settled from both
  directions.**
- **`matchesErrorInputName` spurious `undefined` match** — impossible.
  `candidateInputName` is always `widget.name`, a non-empty string, and
  `[undefined, undefined].includes('anyString')` is `false`.

---

# X2 [BLOCKER] — the F2b guard discards an edge that `whenever` never re-raises

**Lane: error-handling. This is the symmetric failure of the guard I specified.**

`whenever` fires **once**, on the source transitioning to truthy. The guard at
`executionErrorStore.ts:71` returns early during a load — so if the
`hasMissingNodes` true→false transition happens _inside_ the `isLoadingGraph`
window, that one chance is spent and the source stays `true` forever. The check can
never run again.

Consequence when it happens: `hasMissingNodes === false` with a surviving
`missing_node_type` prompt error → `isAbsorbed: false`
(`errorSeverityClassification.ts:28`) → `hasBlockingError: true` (`:74-77`) → the
tab flips to red `octagon-alert`, the red `errorsDetected` / `resolveBeforeRun` hero
appears, and a priority-0 red card names a node **no longer in the graph**.
Unrecoverable until the next `queuePrompt` (`app.ts:1688 clearAllErrors`) or a
`clean`-true load. No dismiss affordance.

This is delta-introduced. Before F2 the cleanup sat at the `removeMissingNodesBy*`
call site with no load guard, so the teardown removal cleared the prompt error. F2
fixed the opposite direction — teardown wrongly clearing when the node _does_ come
back — by suppressing the check entirely, which is wrong in the symmetric case.

## Two lanes contradict each other on reachability — resolve this first

- **vue-patterns**: undo/redo replays the type set cached in `beforeLoadNewGraph`
  via `workflowService.ts:609`, so `hasMissingNodes` stays `true`, the source never
  changes, and there is no transition to lose.
- **error-handling**: `pendingWarnings.missingNodeTypes` is overwritten with `[]`
  during the load, so `surfaceMissingNodes([])` empties the store inside the window.
- **bug-hunter** saw the same shape and dismissed it as "leaves a stale _red_ prompt
  error, never a downgrade" — i.e. it found this bug and filed it as the safe
  direction. It is not safe: it is a permanent false red naming a deleted node.

What I verified myself, which narrows it to one question:

- `showPendingWarnings` (`workflowService.ts:604-609`) reads `wf.pendingWarnings` and
  calls `surfaceMissingNodes(missingNodeTypes ?? [])`, commented "**Always sync
  missing nodes store (clear when empty)**".
- It runs at `app.ts:1547-1551`, **inside** the `isLoadingGraph` window (set `:1395`,
  cleared in the `finally` at `:1558`).
- `activeMissingNodeTypes` (`app.ts:1528`) derives from the JSON scan of the
  **graph being loaded**, so an undo that removed the pasted node yields `[]`.
- `normalizePendingWarnings` maps empty arrays to `undefined` and returns `null` when
  all three are falsy; `updatePendingWarnings` **merges** over the existing value.

**So it hinges entirely on whether anything writes `missingNodeTypes` into
`pendingWarnings` during `loadGraphData`.** If nothing does, the merge preserves the
stale non-empty list and vue-patterns is right. If something writes `[]`,
`emptyToUndefined` makes it `undefined`, `surfaceMissingNodes([])` empties the store
inside the window, and error-handling is right.

Trace `workflowService.ts:420`, `:627`, `missingModelPipeline.ts:63`, `:144`, and any
`updatePendingWarnings` reachable from `loadGraphData`. **Report which lane is right
before you implement.**

## The fix is the same either way — implement it regardless

Reachable today or merely latent, discarding an edge that is never re-raised is the
wrong shape. Do not "fix" it by removing the guard: that reintroduces the F2b bug
undo/redo destroying a live prompt error.

Re-evaluate **after** the window closes instead of discarding the transition. Mirror
the load flag reactively and watch the conjunction, so one funnel covers both
directions with no extra call site:

```ts
whenever(
  () => !missingNodesStore.hasMissingNodes && !isLoadingGraph.value,
  () => {
    if (isMissingNodePromptError(lastPromptError.value))
      lastPromptError.value = null
  },
  { flush: 'sync' }
)
```

`ChangeTracker.isLoadingGraph` is a plain static and therefore not reactive — you
need a `ref` written alongside it, or another existing reactive signal for the same
condition. **If adding a reactive mirror means touching `ChangeTracker`, stop and
ask** rather than widening scope on your own.

**Keep `flush: 'sync'`.** vue-patterns established it is load-bearing, not
incidental: `app.ts` calls `rescanAndSurfaceMissingNodes` (`:1851`) and
`recordPromptError` (`:1904`) in one synchronous block, and under the default `'pre'`
flush the callback would run _after_ `:1904` and wipe a freshly recorded blocking
error, leaving the panel empty for a failed run. Add a comment saying so — this is a
genuine non-obvious why and two lanes flagged its absence.

## Tests

- "an undo that lands on a state without the missing node clears the absorbed
  missing-node prompt error" — must fail if the guard is restored as an
  unconditional early return.
- F2's existing graph-loading retention test (node re-surfaced) must keep passing.
- Both driven through the real undo path, not by assigning the static flag — see H16.

---

## H16 [NIT] — the F2b test's title claims undo but its body sets a static flag

**Lane: human-checklist. Verified: `useErrorClearingHooks.test.ts:566-571` assigns
`ChangeTracker.isLoadingGraph = true` directly around `graph.remove(node)`.**

The production coupling — undo → `ChangeTracker.updateState` → `app.loadGraphData` →
`isLoadingGraph = true` (`app.ts:1395`) — is real but **untested**, so the test
cannot fail if that coupling breaks. It pins the flag, not undo.

This also corrects a note I recorded earlier from the dx-readability lane, which
cited this test as evidence the undo invariant was pinned. It pins the flag only.

Either rename it to say what it does, or drive it through the real undo path. Given
X2 needs a real-undo test anyway, do the latter and let this one become that test.

## H17 [NIT] — F2 deleted a helper that was carrying two rules, not one

**Lane: human-checklist. Verified against the diff.**

My round-7 contract said to delete `resolveReplacedMissingNodeTypes` "if it exists
only for this". It did not — it also carried the `replacedTypes.length === 0` guard.
Both `replaceGroup` (`:339-344`) and `replaceAllGroups` (`:350-356`) now inline the
same two lines, so "only remove types that actually replaced" lives in two places.

Restore the helper minus the deleted call. My wording caused this; the fix is mine to
ask for.

---

## Adjudicated: E2E hardcoded testids — DECLINED

human-checklist wants `errorsSummaryHeroError`, `errorsSummaryHeroMissing`,
`panelTabIcon` and an `errorGroupPrefix` added to `selectors.ts`. playwright-e2e read
the actual rule and the actual file: the convention is "use `TestIds` **when a
matching entry exists**", and `browser_tests/fixtures/selectors.ts` has no entry for
any of the three. So the spec is compliant, and adding entries is a repo-wide
improvement beyond this delta. **playwright-e2e wins** — it quoted the rule text.
Do not act.

---

# X2 — ADJUDICATED DOWN to NIT. Do not fix in this PR.

**regression-risk settled it with a mutation proof, and error-handling's own text
contains the recovery path it then denied.**

1. **The desync half is unreachable.** `whenever` in the installed
   `@vueuse/shared@14.3.0` is a plain **non-immediate** watch
   (`dist/index.js:2000`, `{...options, once: false}` — no `immediate`). In the
   desync state `hasMissingNodes` is `false` from the start, so `!hasMissingNodes`
   never _transitions_ to truthy and the callback never runs. "Never populated"
   cannot fire it. Mutation-proved: replacing `whenever` with a `watchEffect` (same
   conditions, no transition semantics) fails 3 tests including
   `keeps a desynced missing-node prompt error after bypassing an unrelated node`
   (`useErrorClearingHooks.test.ts:626`). Restored byte-identically, checksum
   verified both ways.

   So the `4ec0376248` protection — _"in the desync case where the backend reports a
   missing type the re-scan cannot find, the red card is the only surface, and
   deleting any unrelated node must not wipe it"_ — **survived the F2 rewrite**, by
   transition semantics rather than by the old `hadMissingNodes` parameter.

2. **The undo half is real but self-healing.** regression-risk acknowledges exactly
   error-handling's scenario: a true→false transition inside the load window no
   longer clears, so an absorbed missing-node error can escalate amber→red. It then
   judges it (a) the declared F2 intent, (b) resolving **toward blocking**, and
   (c) **self-healing on the next run**, because `app.ts:1688` runs `clearAllErrors()`
   at the top of every queue.

   error-handling named that exact recovery path — "unrecoverable until the next
   `queuePrompt` (`app.ts:1688 clearAllErrors`)" — and then called it
   unrecoverable. The next run is the normal next user action.

**Coordinator decision:** a stale red card naming a deleted node, persisting until
the next run, is a real wart. But it fails toward blocking, it self-heals, and fixing
it requires a reactive mirror of `ChangeTracker.isLoadingGraph` — i.e. touching
`ChangeTracker`, which is scope-widening for a self-healing cosmetic. **Record as
follow-up; do not fix in this PR.**

What _does_ carry into round 10 from this: the `flush: 'sync'` comment. Three lanes
independently established it is load-bearing and two flagged that nothing says so.

---

# ROUND 9 FINAL TALLY (16/18 lanes; austin + import-graph outstanding)

**Blockers: 1** — X1, the cross-axis absorption. Found independently by bug-hunter
and christian, each with a runtime probe; christian proved it delta-introduced by
reverting the F1 expression, and verified its fix against 22 + 82 existing tests
including F1's own lifted-error regressions.

christian's reproduction is the one to use because **it needs no rename**:
`nextUniqueName` (`src/lib/litegraph/src/strings.ts:19-29`) appends `_1`
automatically, so promoting two same-named widgets out of one subgraph yields host
slots `ckpt_name` and `ckpt_name_1` — and the candidate for one interior absorbs the
other interior's blocking error by default.

**Must-fix: 4** — H1 (duplicated classifier input assembly, 3 lanes), H8 (mixed strip
counts amber as errors, 4 lanes), H12 (unnormalizable node-errors key untested,
2 lanes), H15 (E2E asserts the downgrade but not `blockedLastRun`).

**Nits: 14** — H2–H7, H9, H11, H13, H14, H16, H17, X2, plus the `flush: 'sync'`
comment.

**Clean lanes: 6** — adr-compliance, accessibility, vue-patterns, pattern-compliance,
regression-risk, and dx-readability's comment/dead-code sub-lanes.

Both X1 and X2 originate in instructions I wrote in round 7. X1 is F1's coupling
mistake; X2 is F2b's edge-discard. Re-running the fan-out on the fixes is what caught
them.
