# Onboarding Tour POC — Handoff

> Branch: `feat/onboarding-tour-poc` (cut from `main`). This is a **POC / prototype** — hardcoded, no
> gating, no tests. Goal: a game-style guided onboarding tour on the ComfyUI cloud canvas that walks a
> zero-knowledge user to their first "aha" (create an image) and hooks them toward more workflows.

## What this is

When the canvas loads, a hand-held, video-game-style tutorial runs on top of a real template. It uses the
**spotlight + coach-mark + progressive-disclosure** pattern: dim the canvas, spotlight one node at a time,
show an emerald **agent cursor + speech bubble** pointing at the target, and let the user perform real
actions (drag to connect, type a prompt, click Run). It carries through generation and celebrates the
result, then offers a CTA to explore more workflows.

## How to run it

```bash
pnpm dev:cloud:staging   # points DEV_SERVER_COMFYUI_URL at https://stagingcloud.comfy.org/
# open http://localhost:5173/  (sign in to staging if prompted)
```

The tour **auto-starts on canvas ready** (no gating — this is intentional for the POC). It's wired in
`src/views/GraphView.vue` (`onboardingTour.start()` in `onGraphReady`, and `<OnboardingTourOverlay />`
mounted among the global overlays).

- `pnpm dev:cloud:test` → testcloud; `pnpm dev:cloud:staging` → staging. Both proxy `/templates/*` + the
  API to that backend.
- **Real generation (the `generating` → `result` beats) needs a working Run.** On staging/test Run is
  currently the paywalled "Subscribe to Run" button, so `execution_success` won't fire — see "Grace
  fallback" below. A **follow-up PR will enable free-user Run**; once it lands, the live progress bar +
  real result image light up automatically.

## Files (all new unless noted)

- `src/renderer/extensions/onboardingTour/tourSteps.ts` — **the "level design".** Declarative `tourSteps[]`
  - the `TourStep` discriminated union. Hardcoded template constants: `TOUR_TEMPLATE_ID =
'flux_kontext_dev_basic'`, `EDIT_ENGINE_TYPE` (the subgraph node's type id),
    `RUN_BUTTON_SELECTOR`.
- `src/renderer/extensions/onboardingTour/useOnboardingTour.ts` — **the controller** (shared composable).
  Owns `stepIndex`/`isActive`, loads + simplifies the graph, drives per-step spotlight/completion, exposes
  everything the overlay renders.
- `src/renderer/extensions/onboardingTour/OnboardingTourOverlay.vue` — **the presentation.** Teleports to
  `body`, `fixed inset-0 z-3000`. SVG spotlight mask (dim + cutouts), emerald node outlines, ghost-drag
  SVG line, agent cursor + bubble, progress dots, skip. No business logic.
- `src/locales/en/main.json` — `onboardingTour` block (all copy + `hint.*` per step `key`).
- `src/views/GraphView.vue` — **edited**: import + mount overlay, auto-start in `onGraphReady`.

Lives under `renderer/extensions/` (not `platform/`) because it drives litegraph directly — `platform/`
can't import the canvas store (layer-architecture ESLint rule).

## The flow (why it's shaped this way)

Sequenced for **momentum → ownership → aha → expansion**, NOT a feature tour (deliberately dropped
canvas-intro, node-selection trivia, model dropdown, and a left-menu tour — those are power features best
revealed just-in-time later). Product rationale is in the chat; the short version: the tour's job is to get
a nervous newcomer to their first successful result feeling "I made that."

1. **welcome** (reveal, manual Next) — points at Load Image: "This is your starting image…"
2. **connect** (drag, auto) — pre-clears the LoadImage→Edit link, ghost line + cursor guide the drag;
   advances when the input is re-linked.
3. **prompt** (type, manual Next) — focuses the Edit node's `text` widget (prefilled demo prompt kept);
   user types freely, hits Next. **Typing does NOT auto-advance** (continuous action → manual).
4. **save** (reveal, manual Next) — points at Save Image: "Whatever you create lands right here."
5. **run** (click, auto) — cursor jumps to the top-bar Run button; advances on click.
6. **generating** (auto) — spotlights the **Edit node** (where the blurry live preview renders), shows a
   live progress bar; advances on the real `execution_success` event.
7. **result** (last, manual) — spotlights the **Save node**, shows the **final image inline** + a
   prominent **"Explore workflows →" CTA** that opens the template modal (`useWorkflowTemplateSelectorDialog`)
   and ends the tour.

### Step-kind → behavior

- `reveal` / `result`: talk-steps, wait for **Next**.
- `connect` / `run` / `generating`: action-steps (`auto: true`), advance on the real action/event.
- **Grace fallback**: any `auto` step that hasn't completed in **8s** flips `autoStepStalled` → shows a
  subtle Next so the user is never trapped (critical while Run is paywalled and `generating` can't
  complete). A `connect` step that couldn't pre-clear its link also shows Next.

## Key integrations (already wired, verified in-repo)

- **Template load**: `useTemplateWorkflows().loadTemplates()` + `loadWorkflowTemplate('flux_kontext_dev_basic', 'default')`.
- **Graph simplify**: `simplifyGraph()` removes the duplicate LoadImage + all MarkdownNotes, caps oversized
  node widths, lays the 3 kept nodes (Load → Edit → Save) in a clean row. `frameWorkflow()` fits at
  `zoom: 0.85`.
- **Node resolution**: `resolveNode(type, occ)` against `canvasStore.currentGraph`.
- **Connect detection**: poll `toNode.getInputNode(slot)` (robust across subgraph nodes; event-agnostic).
- **Ghost line hides during drag**: `app.canvas.linkConnector.isConnecting`.
- **Run detection**: capture-phase `click` listener matching `RUN_BUTTON_SELECTOR`
  (`[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]`).
- **Generation**: `api.addEventListener('execution_success', …)`; progress from
  `useExecutionStore().executionProgress` (0–1 → %). Result image via
  `useNodeOutputStore().getNodeImageUrls(saveNode)[0]`.
- **Explore CTA**: `useWorkflowTemplateSelectorDialog().show('command', { initialCategory: 'all' })`, then
  `stop()`. Overlay uses `showOverlay` so it never sheets over the modal.

## Design / theme

- Accent: **emerald** (`emerald-400/500`, `#34d399`) — deliberately distinct from ComfyUI's node/link
  blues so it reads as "tutorial UI." (Earlier used azure `#31b9f4`; user rejected — clashed with nodes.)
- Bubble: sleek dark glass (`bg-neutral-900/85 backdrop-blur-md`, emerald hairline border), "GUIDE" label,
  minimal "Next →" text link (user rejected the earlier chunky white pill). Result step swaps in a solid
  emerald CTA button.
- Dim: `rgba(10, 12, 16, 0.66)` neutral cool-black (earlier greenish `rgba(6,10,8,0.72)` was murkier).
- Ghost-drag line: emerald dashed, marching-ants via a scoped `@keyframes` (only place a `<style>` block is
  used; precedented in the repo — Tailwind has no stroke-dashoffset util).

## Known limitations / next steps (POC debt, intentional)

1. **Free-run dependency** — `generating`/`result` only show live progress + the real image once free-user
   Run works (follow-up PR). Until then they fall back to Next after 8s. **This is the #1 thing to finish
   for the full aha.**
2. **Prompt lives inside the subgraph** — the `flux_kontext` template's editable prompt is a promoted
   widget on the subgraph node; the type step targets it and focuses the reachable DOM textarea. If the
   widget renders on the legacy canvas (no DOM input), auto-focus won't fire (Next still works). For prod,
   consider a template whose prompt is a first-class **surface** widget (e.g. `image_flux2_klein_text_to_image`
   has a `PrimitiveStringMultiline` surface prompt) — see chat for the template survey.
3. **Own input (parked)** — the biggest remaining product lever: let the user upload their own image / type
   their own idea (ownership → retention). Deferred per user.
4. **Scalability** — the _pattern_ scales (data-driven step list + reusable primitives `connect`/`type`/
   `run`/`reveal`/`generating`/`result`). To port to another template: swap the step list + generalize
   `resolveNode`/`simplifyGraph` from hardcoded node types to ids/roles. Contained refactor, not a rewrite.
   Real end-state is a small per-template tour-definition format; you'd only tour the 5–10 hero templates,
   not all 200.
5. **Graph is mutated** — `simplifyGraph` deletes nodes / relayouts on start; the user is left with the
   trimmed graph when the tour ends. Fine for POC.
6. **No gating / no persistence / no tests** — POC. Auto-starts every canvas load.

## Gotchas for the next session

- The overlay teleports to `body` (not `#graph-canvas-container`) so it can point at the top-bar Run button;
  all coords are computed in **client space** from `app.canvas.canvas.getBoundingClientRect()` + `ds.offset/scale`.
- HMR on the overlay throws a benign `Cannot read properties of null (reading 'flags')` / `nextSibling` in
  the dev console — it's a hot-reload reconciliation artifact, **not** a cold-load bug. Verify on a fresh
  page load, not after an HMR patch.
- `hintLabel` keys copy by each step's **`key`** field (not `kind`) — every step's `key` must have a
  matching `onboardingTour.hint.<key>` entry or you'll see the raw key string.
- Standards: no `dark:`, `!important`, arbitrary %/px where a util exists, `:class="[]"` (use `cn()`),
  PrimeVue, barrel files. `pnpm format` before committing.
