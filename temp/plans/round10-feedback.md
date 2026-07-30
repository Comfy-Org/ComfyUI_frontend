# Round 10 — one blocker of mine, then the tail

Baseline: `f66a146e15` on `jaeone94/errors-panel-mixed-severity`.
Stay on that branch. **Commit locally in the groups below. Do not push.**

18 review lanes ran against the round 7+8 delta. Full record in
`temp/plans/round9-findings.md`. Everything here is adjudicated: where lanes
disagreed I resolved it against source myself, and the "do not act" list at the
bottom names findings I have deliberately declined so you do not re-litigate them.

---

# Y1 [BLOCKER] — F1 compared names in a namespace with no uniqueness guarantee

**Three lanes found this independently (bug-hunter, christian, austin), each with a
runtime probe. austin drove the real `scanAllModelCandidates` → real
`liftNodeErrorsToBoundary` → real `classifyErrorSeverity` with no hand-built
`extra_info`. This is my mistake — F1 as I specified it caused it.**

## The root cause, stated precisely

`source_input_name` is an **interior**-scoped name. Interior input names are **not
unique** across a subgraph's interior nodes. For a lifted error,
`extra_info.input_name` and a promoted model candidate's `widgetName` are boundary
names produced by the same promotion path; `nextUniqueName`
(`src/lib/litegraph/src/strings.ts:19-29`) distinguishes those promoted names.

F1 added a comparison in the interior namespace **without pairing it to the id that
scopes it**, and the node-id gate cannot compensate:
`missingModelScan.ts:293` records a promoted-widget candidate with
`nodeId: target.executionId` — the **host** — so for any error lifted to host `12`
the gate passes for every promoted candidate on `12`.

That framing is specific to lifted errors. For an unlifted error,
`extra_info.input_name` is still an interior name, and the loose node-id gate admits
a promoted host candidate through its `sourceExecutionId`. The unconditional branch
can therefore compare an interior error name with a boundary candidate name and
false-match. That defect predates F1 and is out of scope here. A fully coupled
follow-up must pair each candidate surface with its own corresponding id rather than
testing either candidate id against either error surface.

## Real output at `f66a146e15`

Fixture: host `12` containing two `CheckpointLoaderSimple`, both promoted; `12:5`
points at `missing.safetensors` (genuinely missing), `12:7` at `None` (not a
candidate at all — `isModelFileName('None')` is false; it just blocks).

```
candidates: [{ nodeId: "12", sourceExecutionId: "12:5", widgetName: "ckpt_name",
               name: "missing.safetensors", isMissing: true }]
lifted["12"].errors:
  { input_name: "ckpt_name",   source_execution_id: "12:5", source_input_name: "ckpt_name" } -> "missing_model"  correct
  { input_name: "ckpt_name_1", source_execution_id: "12:7", source_input_name: "ckpt_name" } -> "missing_model"  WRONG
hasBlockingError = false
```

Node `12:7` blocks the run; the panel shows one amber card and `panel-tab-icon` =
"Setup pending". Installing the checkpoint does not unblock it and nothing on screen
says so.

Proved delta-introduced: reverting only `matchesErrorInputName` to the round-7 form
gives `["missing_model", null]` and `hasBlockingError = true`.

Media is immune — `missingMediaScan.ts:120` always carries the interior id.

## Required fix — implement this shape, do not redesign

Keep the host-name comparison **unconditional for this fix**. It is safe for the
lifted regression because both names come from the same promotion path. Pair
**only** the interior-name comparison with `source_execution_id`:

```ts
function matchesErrorInputName(
  candidateNodeIds: readonly (string | number | null | undefined)[],
  candidateInputName: string,
  error: NodeValidationError
): boolean {
  if (candidateInputName === error.extra_info?.input_name) return true

  const liftedSource = getLiftedErrorSource(error)
  if (!liftedSource) return false

  return (
    candidateInputName === liftedSource.source_input_name &&
    candidateNodeIds.some(
      (id) => id != null && String(id) === liftedSource.source_execution_id
    )
  )
}
```

Call sites pass `[candidate.sourceExecutionId, candidate.nodeId]` for models and
`[candidate.nodeId]` for media.

**Leave `matchesReceivedValue` and its loose `matchesErrorNodeId` gate exactly as
they are.** A reviewer proposed folding the received-value check into the paired
surface too. `received_value` is filename identity, not complete resource identity:
the match is folder-blind, so the same filename in `loras/` and `checkpoints/` can
false-match. Leaving it untouched is still correct because that defect is
pre-existing and folder-aware matching is a separate behaviour change, not because
the absorption is necessarily correct.

While you are in there, hoist the single `getLiftedErrorSource(error)` call so it is
not evaluated twice per candidate.

## Tests

Build the fixture by driving the **real** scan and lift, the way `liftValidationError`
already does — two interior nodes sharing an interior input name, one promoted
candidate, assert the sibling stays `null` and `hasBlockingError` is `true`.

Mutation-proof it: with `matchesErrorInputName` reverted to the unpaired form it must
fail. austin confirmed the fix keeps 105 tests green including the four
renamed-boundary tests F1 added — those must still pass.

Commit alone: `fix(errors): pair the lifted input name with its source node`.

---

# Y2 [MUST-FIX] — F4 deduplicated the classifier and left its input assembly duplicated

**3 lanes (drjkl, architecture, human-checklist). Verified byte-identical.**

`useErrorGroups.ts:247-256` and `useHasBlockingError.ts:18-26` are the same six-field
literal over the same four stores. F4 existed because red-vs-amber was computed twice
and could diverge; it is now _classified_ once but _assembled_ twice. Add a seventh
input, forget one site, and the panel body and the tab-icon gate
(`RightSidePanel.vue:181`) disagree again — the identical failure one level up. The
consistency test that would have caught it was correctly deleted in round 7 as
tautological, which removes the net.

Extract one composable that owns the four store handles and returns the `computed`;
`useHasBlockingError` narrows it to `.hasBlockingError`. All four stores are already
instantiated in `useErrorGroups`, so this adds no lookups.

# Y3 [MUST-FIX] — the mixed strip counts amber items as "errors"

**4 lanes (architecture, complexity, human-review, human-checklist).**

`workflowErrorCount` (`ErrorGroupList.vue:539-541`) sums **every** group regardless of
severity, and F3's branch feeds it into `rightSidePanel.errorsSummary` =
`"{count} error | {count} errors"`.

Use human-review's input in the test — it is a state real users hit:
`prompt_no_outputs` plus one **workflow-level** missing model (`nodeId` is documented
optional, "Undefined for workflow-level models not tied to a specific node"), so
`errorNodeCount` is 0 and the strip renders **"2 errors"** directly below a hero
reading `1 / Error detected` and `1 / Setup pending`.

F3 correctly stopped the "0 nodes affected" reading but resolved the ambiguity toward
calling a warning an error — the exact conflation this PR exists to undo.

```ts
const workflowBlockingErrorCount = computed(() =>
  allErrorGroups.value
    .filter((group) => group.severity === 'error')
    .reduce((sum, group) => sum + group.count, 0)
)
```

Use it for the `errorNodeCount === 0` arm. Update `TabErrors.test.ts:528-541` to
expect `1 error`, matching the red hero. No new i18n key.

Note: a lane also proposed hoisting `errorNodeCount > 0` into the guard because the
zero arm currently returns an object identical to the fall-through. That is true today
but this fix makes them genuinely different, so the duplication disappears as a side
effect. **Do only this fix, not both.**

# Y4 [MUST-FIX] — the node-error half of "default ambiguous failures to blocking" has zero tests

**3 lanes (test-quality, human-checklist, austin), mutation-proved twice by austin:**
setting `(nodeId === null && errors.length > 0)` to `false` leaves 87 tests passing;
deleting the `addUnlocatedErrorToGroup` else-branch at `useErrorGroups.ts:461` leaves
82 passing. The sibling **execution**-error path has two tests that do fail when
re-narrowed. Same commit, same behaviour, one half defended and one not.

Add to `errorSeverityClassification.test.ts`:
`nodeErrors: { 'not::a-node': nodeError([validationError('value_not_in_list', 'ckpt_name')]) }`
**with a matching missing-model candidate**, asserting `hasBlockingError` is `true` —
an unlocatable node error must never be absorbed. Add the `node-not::a-node` unlocated
card assertion to `useErrorGroups.test.ts`, mirroring `:666`.

Named future regression this prevents: generalising `useErrorGroups.ts:431`'s
`if (filterBySelection && !nodeId) continue` to `if (!nodeId) continue` would make the
error vanish from the panel with all 3116 tests green.

# Y5 [MUST-FIX] — Y4's sibling: drop the dead disjunct

**4 lanes.** When `nodeId === null`, `errorSeverityClassification.ts:51-58` already
sets `absorption: null` for every error, so the second disjunct always fires too. The
clause cannot change the result and reads as if node-less errors were handled
specially.

Drop it. The fail-safe lives in the map's `: null`, and Y4's new test is what pins it —
**do Y4 and Y5 in the same commit**. Also change `absorption === null` to
`!absorption`: per this round's principle an `undefined` must not read as absorbed.
No comment explaining the removal.

# Y6 [MUST-FIX] — the E2E asserts the downgrade but not the compensating signal

Every assertion in the new spec is about _downgrading_. If `blockedLastRun` regressed
to `false` — **the field G2 just moved across four union members** — the spec still
passes and the user sees pure amber with no sign the run was blocked. One line inside
the existing test:

```ts
await expect(
  comfyPage.page
    .getByTestId(TestIds.dialogs.missingModelsGroup)
    .getByTestId('blocked-last-run-indicator')
).toBeVisible()
```

---

# Y7 — the `nodes` machinery has no observable effect; make it required

**3 lanes, and the decisive proof is from this repo's own history:** the pre-delta code
at this same site passed `nodes: 0` into `setupSummary` (`"{count} item | {count} items"`,
no `{nodes}`) while `TabErrors.test.ts:505` asserted `'2 items'` and **passed at
`2e9566b8ab`**. `i18n-t` ignores a slot the resolved message does not name.

So `ContextStrip.nodes?: number`, the `...(errorNodeCount.value > 0 && { nodes })`
boolean spread, and `<template v-if="strip.nodes !== undefined" #nodes>` are three
pieces of machinery doing nothing. Make `nodes` a required `number`, populate it on
every branch, restore the plain `<template #nodes>`.

# Y8 — key `SUMMARY_KEYPATHS` by name, not position

`keypathIndex` (`:575`) is the same three-way ternary the refactor claimed to remove,
now producing a magic ordinal. More importantly a lane identified the unstated
invariant that makes it dangerous: _position 0 of each tuple must be the only member
lacking a `{nodes}` placeholder_ — reorder either tuple and a `{nodes}` placeholder
renders with no value. Keying by `none` / `single` / `multiple` makes that structural.

# Y9 — restore the deleted "why", and add the one the watcher is missing

G3 deleted `// Node-less errors (e.g. prompt-level) would read as "0 nodes"`. That
rationale now applies to **two** sites and is documented at neither. Fold it into the
`SUMMARY_KEYPATHS` doc comment.

Separately, add a comment on `flush: 'sync'` in `executionErrorStore.ts`. **Three
lanes independently established it is load-bearing:** `app.ts` calls
`rescanAndSurfaceMissingNodes` (`:1851`) and `recordPromptError` (`:1904`) in one
synchronous block, and under the default `'pre'` flush the callback would run _after_
`:1904` and wipe a freshly recorded blocking error, leaving the panel empty for a
failed run. Two lanes flagged that nothing says so. One line, naming that reason.

# Y10 — name the classifier for its whole output, and declare its return type

Three of `classifyErrorSeverity`'s four returned fields are the panel's primary
rendering data — `processNodeErrors` builds every execution group from
`errorSeverity.value.nodeErrors` (`useErrorGroups.ts:429`). Someone looking for
"where do the rendered node errors come from" will not open a file named
`errorSeverityClassification.ts`. Rename the **function** to cover its output and
declare a named exported return type beside `ErrorSeverityInput`. **Keep the module
filename** — renaming it churns imports for no gain.

# Y11 — narrow two unions

`errorSeverityClassification.ts:16-20`: nobody passes `undefined`. For `promptError`,
`missingModels`, `missingMedia` the `| undefined` mirrors pre-existing callee
signatures (defensible pass-through); for `executionError` and `nodeErrors` it mirrors
nothing. Narrow those two.

# Y12 — restore the helper F2 deleted

My round-7 contract said to delete `resolveReplacedMissingNodeTypes` "if it exists only
for this". It did not — it also carried the `replacedTypes.length === 0` guard, which is
now inlined in both `replaceGroup` (`:339-344`) and `replaceAllGroups` (`:350-356`).
Restore it minus the deleted call. My wording caused this.

# Y13 — fix the `blockedLastRun` divergence in the selection builders

`buildMissingModelGroups(blockedMissingGroups.has('missing_model'))` derives the flag
while `buildMissingModelGroupsForSelection()` hardcodes `false` for the **same group
type**. Two builders, one `type`, contradictory truth for one field — the first
consumer to read it off `selectionScopedGroups` gets a silent lie. Thread the real
value in.

(A lane proposed instead moving `blockedLastRun` onto a `MissingResourceGroupBase` that
only the four missing-* members extend, so `execution` groups are not forced to assert
something meaningless. That is arguably better but it re-opens G2's type shape. **Do
not do it** — thread the value. If threading turns out to be impossible for the
selection builders, stop and report rather than reshaping the union.)

# Y14 — the F2b test's title claims undo but its body sets a static flag

`useErrorClearingHooks.test.ts:543` assigns `ChangeTracker.isLoadingGraph = true`
directly around `graph.remove(node)`. The production coupling — undo →
`ChangeTracker.updateState` → `app.loadGraphData` → `isLoadingGraph = true`
(`app.ts:1395`) — is real but untested, so the test cannot fail if it breaks. Drive it
through the real undo path, or rename it to say what it does. Prefer the former.

# Y15 — drop redundant tests

- `useErrorClearingHooks.test.ts:597-630` — the two `it.for` cases seed **no** missing
  node types, so the watcher source is already `true` at construction and never
  transitions; all three tests land on an early return and assert the same line. Mute
  and bypass are collapsed into one OR at `useErrorClearingHooks.ts:147` and that
  distinction is covered at `:1164`. Keep `:577` and `:632`; drop the `it.for` block.
- `TabErrors.test.ts` — the four tab-icon tests each assert a `toHaveClass` and a
  `toHaveAccessibleName` on consecutive lines, but `RightSidePanel.vue:196-204` derives
  both from the single `hasBlockingError` boolean, so the class half asserts nothing new.
  Drop the four `toHaveClass` calls, keep the accessible-name partners. Also delete
  `'text-charcoal-800'` from `:492` and the assertion at `:496` — that token is one a
  designer may replace with a semantic token, and the test would then break with no
  behaviour change. **Do not** touch the `error-section-count-badge` class assertions
  (`:257`, `:490`, `:596`) — that badge exposes per-group severity through no other
  DOM handle.

---

## Do not act — adjudicated

- **X2, the `whenever` edge discarded during a graph load.** One lane filed it as a
  blocker: an undo that lands on a state without the missing node leaves a stale red
  card naming a deleted node. regression-risk settled it — `whenever` in the installed
  `@vueuse/shared@14.3.0` is non-immediate, so the desync case cannot fire it at all
  (mutation-proved: swapping in a `watchEffect` fails 3 tests). The undo escalation is
  real but fails **toward blocking** and self-heals on the next run via
  `app.ts:1688 clearAllErrors` — the filing lane named that recovery path itself and
  then called it unrecoverable. Fixing it needs a reactive mirror of
  `ChangeTracker.isLoadingGraph`. **Recorded as follow-up. Do not fix here.**
- **E2E hardcoded testids.** One lane wanted `selectors.ts` entries added. The rule is
  "use `TestIds` when a matching entry exists" and no entry exists for those three, so
  the spec is compliant; adding entries is a repo-wide change beyond this delta.
- **`text-charcoal-800` / a `--warning-foreground` token.** Designer's call; it has
  precedent at `button.variants.ts:28`.
- **Moving `blockedLastRun` off `ErrorGroupBase`** — see Y13.
- **Splitting `useErrorGroups.ts` (999 lines) or `ErrorGroupList.vue` (707).**
  Pre-existing size; architecture-level.
- Pre-existing lint warnings, the `TabErrors.test.ts` cold-cache flake,
  `GraphView.test.ts`, `onboardingCloudRoutes`, `useCanvasHistory.test.ts` teardown.

## Gates

```
pnpm vitest run src/components/rightSidePanel src/components/error src/stores src/composables src/platform/nodeReplacement src/core/graph/subgraph
pnpm typecheck && pnpm lint && pnpm format && pnpm knip
```

Commit groups: Y1 alone; Y2; Y3; Y4+Y5 together; Y6; Y7+Y8+Y9; Y10+Y11; Y12+Y13;
Y14+Y15. Leave the worktree clean. **Do not push.**

## Report

Per item: what changed, the mutation-proof outcome where required (Y1, Y4), whether
Y13's threading was possible, and anything that contradicted this file. Y1 and the
round-9 findings both came out of instructions I wrote — if you can see something here
is wrong, say so rather than implementing it.
