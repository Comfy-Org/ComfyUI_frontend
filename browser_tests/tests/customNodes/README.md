# Custom-node regression suite

Proves community custom-node packs work against this frontend across both
renderers: nodes register, render under LiteGraph (canvas) AND Vue Nodes 2.0
(DOM), and execute real workflows end to end. Manifest-driven: adding a pack
is one JSON row, no new test code.

## Prerequisites

1. A ComfyUI backend on `127.0.0.1:8288` with the manifest packs
   (ComfyUI-Impact-Pack, ComfyUI-VideoHelperSuite) and ComfyUI_devtools
   installed. Launch it with `--cache-none` (repeat runs must re-execute
   every node or the executed-set check fails honestly with `PARTIAL`) and
   with `browser_tests/assets/plain_video.mp4` copied into its `input/` dir.
2. The dev server proxying that backend:
   `DEV_SERVER_COMFYUI_URL=http://127.0.0.1:8288 pnpm dev`

## Running

| Script                                 | What it does                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm test:custom-nodes`               | whole suite headless - the pass/fail gate (every tier passes, zero skips)             |
| `pnpm test:custom-nodes:watch`         | headed slow-motion run of the browser tiers, hands-off watching                        |
| `pnpm test:custom-nodes:debug`         | step through the browser tiers in the Playwright Inspector (F10 step, F8 resume)       |
| `pnpm test:custom-nodes:impact-render` | Impact nodes render in both renderers (Inspector)                                      |
| `pnpm test:custom-nodes:impact-run`    | Impact group workflow executes on the backend (Inspector)                              |
| `pnpm test:custom-nodes:vhs-render`    | VHS nodes render in both renderers (Inspector)                                         |
| `pnpm test:custom-nodes:vhs-run`       | VHS decodes a real video through its node chain (Inspector)                            |
| `pnpm test:custom-nodes:connectivity`  | slot/type contract: type-paired links + real slot drags in both renderers (Inspector)  |
| `pnpm test:custom-nodes:self-check`    | watches the harness catch a deliberate execution error                                 |

Example - watch the VHS video-decode run step by step:

```bash
pnpm test:custom-nodes:vhs-run
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
  element mounts under Vue Nodes 2.0. Both renderer passes.
- **T1 run**: the manifest workflow is loaded and queued; the backend's
  `executing` event stream must contain every expected node id, and the run
  must end in `execution_success`.
- **T-conn connectivity (contract)**: wiring-only, no execution. A
  type-pairing generator (`fixtures/customNode/typePairing.ts`) indexes
  `/object_info` producers/consumers and plans one representative typed edge
  per slot (wildcard `*` slots excluded - they bypass the real type compare
  and prove nothing). Each planned edge must connect through the real
  `isValidConnection` veto, then survive `serialize()` -> `configure()` and
  appear in `graphToPrompt()` output. A curated subset is additionally
  dragged for real - slot dot to slot dot - under both renderers. Orphan
  types (no partner in the corpus) are reported, never fake-failed. One
  representative edge per slot bounds cost; it does not prove all pairs.
- **Zero visible errors, always**: every browser test asserts the app's
  error surfaces (error overlay, error dialog, node render errors, error
  toasts) are absent at start and after every pass. A run is green only if a
  human watching the screen sees no errors. The self-check inverts this: it
  forces a real execution error and asserts the overlay IS visible, proving
  the selectors stay live.

## Adding a pack

Add one row to `browser_tests/fixtures/data/customNodeManifest.json` with
every field of the schema: `pack`, `repo`, `pin`, `tiers`, `workflow` (empty
string until the run tier), `expectedNodes` (the pack's `object_info`
class_type keys, not Python class names), `requiresGpu`, `requiresModels`,
and `timeoutMs` - `loadManifest()` fails loudly on missing fields. The
`connectivity` tier needs no extra assets - the pairing generator derives
everything from `/object_info`. For the run tier, add a model-free
frontend-format workflow under `browser_tests/assets/customNodes/` and set
the tier. Reuse existing repo media assets - do not commit new binaries.

## Gotchas

- Do not run with `--trace on` against system Chrome
  (`playwright.chrome.config.ts` pins trace off): the trace recorder crashes
  pages under the branded Chrome channel and every test reports a bogus 15s
  timeout.
- In a git worktree whose `node_modules` is symlinked from another checkout,
  prefix scripts with `pnpm --config.verify-deps-before-run=false ...` to
  skip pnpm's auto-install check.
- First run against a cold dev server can exceed the 15s per-test setup
  budget while Vite compiles; just run again.
