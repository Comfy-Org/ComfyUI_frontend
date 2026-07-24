# Custom-node regression suite

Proves community custom-node packs work against this frontend across both
renderers: nodes register, render under LiteGraph (canvas) AND Vue Nodes 2.0
(DOM), and execute real workflows end to end. Manifest-driven: adding a pack
is one JSON row, no new test code.

System design, data flow, and the reasoning behind every invariant:
[ARCHITECTURE.md](ARCHITECTURE.md). Onboarding a new pack:
[ADDING_CUSTOM_NODES.md](ADDING_CUSTOM_NODES.md).

## Prerequisites

1. A ComfyUI backend on `127.0.0.1:8288` with every manifest pack (the
   `pack` entries in `browser_tests/fixtures/data/customNodeManifest.core.json`)
   and ComfyUI_devtools
   installed. Launch it with `--multi-user` (the repo-wide browser-test
   prerequisite; the fixture writes per-worker user settings and the suite
   depends on them landing), `--cache-none` (repeat runs must re-execute
   every node or the executed-set check fails honestly with `PARTIAL`), and
   with `browser_tests/assets/plain_video.mp4` copied into its `input/` dir.
2. The dev server proxying that backend:
   `DEV_SERVER_COMFYUI_URL=http://127.0.0.1:8288 pnpm dev`

## Running

| Script                                | What it does                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test:custom-nodes`              | whole suite headless against the Vite dev server - the fast local loop for suite-code iteration. NOT the gate: the dev server never loads pack frontend JS (see Gotchas)                                                                                                                         |
| `pnpm test:custom-nodes:ci`           | whole suite headless against the backend-served BUILT frontend - the gate-equivalent run (every tier passes, zero skips). Requires a backend serving the built dist on :8188 (a separate endpoint from the :8288 dev-proxy backend in Prerequisites); set `PLAYWRIGHT_TEST_URL` if yours differs |
| `pnpm test:custom-nodes:watch`        | headed slow-motion run of the browser tiers, hands-off watching                                                                                                                                                                                                                                  |
| `pnpm test:custom-nodes:debug`        | step through the browser tiers in the Playwright Inspector (F10 step, F8 resume)                                                                                                                                                                                                                 |
| `pnpm test:custom-nodes:connectivity` | slot/type contract: type-paired links + real slot drags in both renderers (Inspector)                                                                                                                                                                                                            |
| `pnpm test:custom-nodes:self-check`   | watches the harness catch a deliberate execution error                                                                                                                                                                                                                                           |

Scope any run to one pack or tier with Playwright's `-g` filter (titles follow
`<pack>` / `T0` / `T1` patterns) instead of adding per-pack scripts - the
script list stays fixed while the manifest grows:

Example - watch the VHS video-decode run step by step:

```bash
pnpm test:custom-nodes:debug -g "VideoHelperSuite.*T1"
```

Two windows open: the app under test and the Playwright Inspector. Press F10
to execute one robot action at a time (workflow loads, queue fires, backend
decodes the video), F8 to run to the end. While paused, look but do not click
inside the app window - your clicks change the state the next assertion
checks.

Any `-g` pattern works against the generic scripts, e.g.
`pnpm test:custom-nodes:debug -g "Impact-Pack.*T0"`.

## What the tests assert

- **T0 load**: pack nodes are registered in `/object_info`, added to a
  cleared graph, counted exactly, and each added node's own `[data-node-id]`
  element mounts under Vue Nodes 2.0. Both renderer passes - unless the pack
  declares `vueNodesCompatible: false` in the manifest (evidence required;
  see [ADDING_CUSTOM_NODES.md](ADDING_CUSTOM_NODES.md)), in which case its tests run their
  LiteGraph-canvas assertions only. Never a skip. T0 also asserts each
  pack's declared frontend extensions registered (`expectedExtensions`):
  backend nodes can appear while the pack's JS silently failed to load.
- **T1 run**: the manifest workflow is loaded and queued; the backend's
  `executing` event stream must contain every expected node id, and the run
  must end in `execution_success`.
- **Dynamic inputs** (`dynamicInputs.spec.ts`): autogrow nodes (pack JS adds
  an input when the last one is connected, removes trailing empties on
  disconnect) grow and shrink correctly, via BOTH a real mouse drag and a
  programmatic connect, under both renderers, asserted in the graph AND (in
  the Vue renderer) as a rendered slot row, both directions. This behavior
  lives in pack JS, not `/object_info`, so no def-driven tier can see it.
  Curated cases live in the spec's `AUTOGROW_CASES` table.
- **Every-node tiers** (`allNodes.spec.ts`): the pack's FULL node list,
  discovered live from `/object_info`, is exercised with zero
  configuration - every registered node mounts in both renderers (chunked
  at an empirically measured batch size), survives a serialize/configure
  save-reload round-trip, and executes for real on the backend when
  self-sufficient (all required inputs are widgets with valid defaults).
  Nodes that cannot run alone are classified and logged
  (`NEEDS_WIRES` / `NEEDS_MODELS` / `NO_OBSERVABLE_OUTPUT` / rejected-at-validation),
  never silently dropped; the documented exception ledgers (see
  [ADDING_CUSTOM_NODES.md](ADDING_CUSTOM_NODES.md)) carry a written mechanism for every
  escape hatch.
- **Layout geometry**: while the mount sweep has each node on screen, its
  geometry (node size, widget-row positions, slot positions, in both
  renderers) is measured and compared exactly against committed per-pack
  baselines - any layout shift, the "shrinking node" class, fails naming
  the node and field. The compare runs in CI only (local runs log and
  skip: baselines encode CI fonts and pack-JS layout, which local
  environments cannot reproduce). Baselines are recorded automatically by
  the record workflow (`.github/workflows/record-custom-nodes-geometry.yaml`);
  nodes with genuinely racy layout are ledgered by mechanism in
  `GEOMETRY_UNSTABLE_NODES` (see
  [ADDING_CUSTOM_NODES.md](ADDING_CUSTOM_NODES.md)).
- **connectivity (contract)**: wiring-only, no execution. A
  type-pairing generator (`fixtures/customNode/typePairing.ts`) indexes
  `/object_info` producers/consumers and plans one representative typed edge
  per slot (wildcard `*` slots excluded - they bypass the real type compare
  and prove nothing). Each planned edge must connect through the real
  `isValidConnection` veto, then survive `serialize()` -> `configure()` and
  appear in `graphToPrompt()` output. A curated subset is additionally
  dragged for real - slot dot to slot dot - under both renderers. Orphan
  types (no partner in the corpus) are reported, never fake-failed. One
  representative edge per slot bounds cost; it does not prove all pairs.
- **Zero visible errors**: the mount, persistence, connectivity, core
  smoke, and curated workflow tests assert the app's error surfaces (error
  overlay, error dialog, node render errors, error toasts) are absent at
  start and after every pass - green means a human watching those runs sees
  no errors. Two deliberate exceptions: the auto-run execution tier
  provokes expected failures (baselined cannotRunAlone nodes surface as
  real error UI by design), and the self-check inverts the invariant - it
  forces a real execution error and asserts the overlay IS visible, proving
  the selectors stay live.
- **Console-error window**: the console/page-error ledger (curated run,
  save/reload) starts collecting inside each tier, so it covers the tier's
  own actions - load, run, wire, save. Pure console noise a pack logs at
  app boot, before the first tier action, is out of that window by design:
  the shared app fixture navigates once at setup, so boot output predates
  any per-pack collector. Boot breakage that MATTERS still fails the gate -
  the zero-visible-errors check runs at startup and catches any boot error
  that reaches a visible surface; only invisible, functionally-inert boot
  console noise (the ledger's whole reason to exist) is out of scope.

## CI

The suite deploys across several workflows against the same manifest;
[ARCHITECTURE.md section 13](ARCHITECTURE.md#13-the-ci-deployment-view) has the
full deployment view. Which backend a run targets is chosen by
`CUSTOM_NODES_ENV` (`core`, the default, or `cloud`) - same suite, backend
swapped.

- **The core PR gate** (`custom-nodes-e2e-core` in `ci-tests-custom-nodes.yaml`;
  mark it as a required check in branch protection once this lands):
  `CUSTOM_NODES_ENV=core` against a local Python backend with every git surface
  pinned - ComfyUI core at the exact verified commit (`comfyui_ref`) and every
  pack at its manifest pin - so a red points at the PR, not at drift. Skipped
  tests are failures.
- **The cloud PR gate** (`custom-nodes-e2e-cloud` in
  `ci-tests-custom-nodes-cloud.yaml`): the SAME suite with
  `CUSTOM_NODES_ENV=cloud` against the remote Comfy Cloud backend - no pack
  install; expectations come from the generated cloud manifest and re-float
  when Cloud redeploys. Gated on the cloud smoke secrets: with any absent the
  job emits a `::notice` naming the missing ones and no-ops green (required-safe
  pre-calibration - it never fake-passes a green "0 tests"); with all present
  the suite runs for real. Skipped tests are failures.
- **The nightly canary** (`ci-nightly-custom-nodes-canary.yaml`,
  non-gating): where drift surfaces instead. Two jobs, one moving git
  variable each: `canary-core-drift` floats ComfyUI core with packs
  pinned; `canary-pack-drift` floats the packs at their authors' latest
  with core pinned. A red or cancelled run files or updates one
  label-deduped tracking issue carrying the run link, report artifact
  name, and triage playbook. It never blocks a PR or a release.

## Adding a pack

One manifest row plus one small workflow JSON - no new test code. The
authoritative step-by-step process (verifying the pack's real node keys,
authoring the run workflow, the `vueNodesCompatible` evidence rule, what CI
does with the row) lives in [ADDING_CUSTOM_NODES.md](ADDING_CUSTOM_NODES.md). Follow it
exactly; the traps it lists all shipped in real packs.

## Gotchas

- **Pack frontend JS does not load under the Vite dev server.** The dev
  server's `/extensions` endpoint lists core extensions only, so nodes render
  vanilla locally even when the backend has the packs installed. CI serves
  the built frontend from the backend, where every pack's JS loads and can
  restyle nodes, rebuild widgets, or inject page chrome. Before pushing
  changes that could interact with pack JS, reproduce CI locally:
  `pnpm build`, relaunch the backend with `--front-end-root <repo>/dist`,
  and run the suite with `PLAYWRIGHT_TEST_URL` pointed at the backend.
- Do not run with `--trace on` against system Chrome
  (`playwright.chrome.config.ts` pins trace off): the trace recorder crashes
  pages under the branded Chrome channel and every test reports a bogus 15s
  timeout.
- In a git worktree whose `node_modules` is symlinked from another checkout,
  prefix scripts with `pnpm --config.verify-deps-before-run=false ...` to
  skip pnpm's auto-install check.
- First run against a cold dev server can exceed the 15s per-test setup
  budget while Vite compiles; just run again.
