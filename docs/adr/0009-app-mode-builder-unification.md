# 9. App Mode and App Builder Unification

Date: 2026-05-08

## Status

Proposed

## Context

App Mode (the runtime view consumed by an app's end users) and App
Builder (the authoring view used to wire inputs and outputs) were
implemented as parallel UIs. They shared the workflow graph but each
maintained its own chrome (top bar, panel rails, run controls), its
own panel layout state, its own viewport pan/zoom state, and its own
output-display affordance (a thumbnail strip in App Mode, an inline
preview in Builder).

This produced four recurring problems:

1. **Loss of WYSIWYG.** Edits in Builder did not appear identically in
   App Mode. Authors had to switch modes, verify, and repeat.
2. **State drift.** Panel preset, panel collapse, and per-input grid
   position lived in disconnected places, with no single
   serialization surface. Workflow files persisted partial state.
3. **Duplicated chrome.** Run/Stop, batch count, zoom controls,
   builder-step controls, and feedback affordances were each rendered
   by both modes' chrome with mode-specific bug fixes that drifted.
4. **Single-output bottleneck.** App Mode displayed one output at a
   time via a thumbnail strip. Comparing or arranging multiple
   outputs required leaving App Mode entirely. App Mode users
   asked for a mood-board surface; App Builder users asked for "the
   real thing the user will see" in the authoring view.

Related: PR
[#11317](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11317).

## Options

### A. Translation layer between parallel UIs

Keep App Mode and Builder as separate components. Add a translation
layer that maps Builder edits into App Mode's runtime state and vice
versa.

- **Pro**: Smallest change. Each mode keeps its current shape.
- **Pro**: No risk to the App Mode runtime contract used by deployed
  apps.
- **Con**: The translation layer becomes its own correctness surface,
  requiring tests and maintenance every time either mode adds a
  feature.
- **Con**: WYSIWYG still relies on a translation step, not on
  shared rendering. Subtle visual drift remains.
- **Con**: The single-output thumbnail-strip vs. multi-output
  mood-board question is unaddressed — that's a UX decision the
  translation layer can't make for either mode.

### B. Generate App Mode from Builder state at save time

Builder edits a richer authoring document; on save, the document is
compiled into the App Mode runtime state (a different shape).

- **Pro**: Clear separation of authoring concerns vs. runtime
  concerns.
- **Pro**: Builder gets free reign on structure without affecting the
  runtime contract.
- **Con**: Same WYSIWYG loss as A — App Mode runs the _output_, not
  the live edit. Authors still need to save + reload to verify.
- **Con**: Two document shapes to keep in sync.
- **Con**: Doesn't simplify the chrome duplication or address the
  single-output question.

### C. Unify via shared store + shared components (selected)

App Mode and Builder render the **same** chrome and panel components,
backed by a **single** store (`appModeStore`) holding panel preset,
panel rows, viewport state, selected inputs, and selected outputs.
Builder edits write directly to the same state App Mode consumes;
the only mode-specific differences are the conditional
edit-affordance overlays (drag handles on panel blocks, the
input/output-selection scrim in Builder, etc.).

The output surface is generalized to a multi-window workspace inside
a pan/zoom viewport (the "mood board"); each generation produces a
floating output window that can be promoted, repositioned,
maximized, or pruned. The single-output thumbnail strip is removed.

- **Pro**: WYSIWYG by construction. There is no translation layer
  because the two modes render the same components against the
  same state.
- **Pro**: Chrome rendering, panel reordering, viewport state,
  and output windowing each have **one** implementation. Bug
  fixes and refinements apply uniformly.
- **Pro**: Workflow serialization gets a single coherent shape
  (`extra.linearData.layout`) that captures the unified state
  forward-compatibly via `.passthrough()`.
- **Pro**: Multi-window output workspace addresses the long-standing
  request for arrange-and-compare without leaving App Mode.
- **Con**: Larger PR than typical. The chrome + store + panel +
  output-windows interlock means that splitting the change into
  smaller PRs would require flag-gated half-states or
  almost-immediate rewrites of one half by the other.
- **Con**: New surface area in `appModeStore` (viewport math,
  panel-row reconciliation) and `outputWindowStore` (eviction,
  bento layout) to keep tested and maintained.
- **Con**: Output windows persist beyond their source generation
  (moodboard semantics), which is a behavior change from the prior
  thumbnail strip. Cleanup is now an explicit user action ("Clear
  all output windows" in the chrome rail).
- **Con**: The drag/resize semantics differ between zoom mode (free
  placement) and no-zoom dashboard mode (auto-arranged grid). The
  `relayoutDashboard()` and pruning logic are non-trivial.

## Decision

Adopt **Option C**.

The unification is implemented as:

- `appModeStore` — single source of truth for panel preset, panel
  rows, viewport pan/zoom, selected inputs/outputs, and per-input
  widget config. Persists to `rootGraph.extra.linearData` via
  builder-mode-only watchers.
- `AppChrome.vue` + `FloatingPanel.vue` — rendered by both modes via
  the `variant` prop, which gates only edit affordances and chrome
  topology, not the underlying state.
- `outputWindowStore` — multi-window output state, with an eviction
  policy (in-flight tier > finalized tier; finalized within tier
  evicted by `createdSeq`, not click-mutable `zIndex`) and a
  bento-template auto-layout when no-zoom dashboard mode is active.
- `LayoutView.vue` — the pan/zoom workspace host that App Mode and
  the Builder's arrange step both render into.
- Workflow schema gains `extra.linearData.layout` as a partial,
  passthrough-permitted block carrying `panelPreset`,
  `panelCollapsed`, `panelWidthCells`, and `panelRows`.

## Consequences

### Positive

- WYSIWYG between Builder and App Mode is structural, not asserted
  by tests.
- Future panel features (additional presets, new block kinds, panel
  resize semantics) land once and apply to both modes.
- Output windowing replaces the single-thumbnail surface and opens
  the door to comparison-driven authoring loops without a separate
  mode for it.
- Builder no longer needs to ship its own chrome; existing chrome
  cells (`RunCell`, `BatchCountCell`, `JobQueueCell`,
  `ModeToggleCell`, `FeedbackCell`, `IconCell`) participate in
  Builder's footer too.
- Workflow files become forward-compatible carriers of layout
  state. Older clients ignore the new fields cleanly via
  `.passthrough()`.

### Negative

- The PR introducing the unification is large. The "Why this is
  one PR" rationale is recorded in PR #11317's description; future
  similar unifications should expect the same shape.
- `appModeStore` accumulates more than the original App Mode
  responsibilities. Its public surface is broader than is
  conventionally Pinia-idiomatic.
- The dashboard relayout math (eviction, bento templates,
  panel-aware tile distribution) is novel layout code with limited
  precedent in the codebase. It must remain unit-tested as it
  evolves.
- Output windows that survive a workflow swap are a behavior
  change. Users expect the prior generation's outputs to persist
  across runs of a different workflow until explicitly cleared.

## Notes

- The unification deliberately **does not** introduce a CRDT or ECS
  for panel state. App Mode panel state is workflow-local and
  user-owned; the document-collaboration concerns ADR
  [0003](0003-crdt-based-layout-system.md) addresses do not apply.
  ADR [0008](0008-entity-component-system.md)'s entity-system scope
  is graph entities (LGraphNode etc.), not panel chrome, and is
  therefore also out of scope here.
- The semantic-token gap surfaced during the conformance pass for
  this PR (`--success-foreground`, `--destructive-foreground`,
  `--primary-foreground` not previously present in the design
  system) is documented as a follow-up upstream-PR opportunity in
  [comfyui-theme-tools](https://github.com/eliheuer/comfyui-theme-tools)'s
  `docs/upstream-pr-opportunities.md`. App Mode references the
  underlying tokens via Tailwind 4 arbitrary-value syntax
  (`text-(--success-foreground)`) until the design-system tier is
  expanded.
- The four `<style scoped>` blocks in `InputCell`, `ModeToggleCell`,
  `FeedbackCell`, and `PanelBlockList` use `:deep()` + `!important`
  to reset third-party widget chrome (PrimeVue, Typeform). Each
  carries an inline TODO citing a `layout` prop on `NodeWidgets`
  as the proper upstream fix; landing that prop is a follow-up.
