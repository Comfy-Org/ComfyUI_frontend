# Adding a custom-node pack to the regression suite

The authoritative, step-by-step process for onboarding a new pack. Written to
be followable by a human or an agent with no prior context. The suite itself
(what it asserts, how to run it) is documented in [README.md](README.md);
this file is only about adding coverage for a new pack.

The short version: install the pack on a local test backend, read the pack's
real node keys out of `/object_info`, author one small model-free workflow,
add one row to the manifest, prove it green locally, push. No new test code
is ever needed - the specs iterate the manifest.

## What a manifest row buys you (the tiers)

Adding the one row enrolls the pack in two kinds of coverage:

- **Every-node tiers (automatic, zero configuration).** The suite reads the
  pack's FULL node list from the live backend and, for every registered
  node: mounts it in both renderers, round-trips it through save/reload,
  plans typed connections for all its concrete slots, and executes it for
  real when it is self-sufficient (every required input is a widget with a
  valid default; output wired to `PreviewAny` or the node is its own
  terminus). Nodes that cannot run alone are classified and logged, never
  silently dropped: `NEEDS_WIRES` (required socket inputs), `NEEDS_MODELS`
  (empty model/file combo on the bare backend), `NO_SINK` (nothing
  observable to queue), or "rejected at validation on defaults" (needs a
  curated fixture).
- **Curated tiers (the row's fields).** `expectedNodes` + `workflow` drive
  the hand-authored run-tier chain (Step 4) proving a real multi-node
  wiring executes end to end, and serve as must-exist sentinels.

Every-node coverage means a pack update is tested the moment CI installs
it - including nodes you never listed.

## Step 0 - prerequisites

- A local test backend and dev server set up exactly per the
  [README prerequisites](README.md#prerequisites). Do not skip `--multi-user`
  or `--cache-none`.
- The pack's GitHub URL. The CI job clones and pip-installs it, so the repo
  must be public and its `requirements.txt` must install on a CPU-only
  runner. Packs that hard-require CUDA at import time cannot be onboarded
  until they guard that import.

## Step 1 - install the pack on the test backend

```bash
cd <test-backend>/custom_nodes
git clone https://github.com/<owner>/<pack>
pip install -r <pack>/requirements.txt   # if the pack has one
```

If you run a CPU-only backend, constrain pip so the pack cannot swap in a
different torch (CI does the same):

```bash
pip freeze | grep -iE '^(torch|torchvision|torchaudio)==' > /tmp/torch-constraints.txt
pip install -r <pack>/requirements.txt -c /tmp/torch-constraints.txt
```

Restart the backend and check its log: the `Import times for custom nodes`
block must list the pack with no `IMPORT FAILED` marker. An import failure is
a pack bug or a missing dependency - fix that first; nothing downstream can
work without a clean import.

While you are here, note whether the pack ships frontend JS:

```bash
curl -s http://127.0.0.1:8288/extensions | python3 -c '
import json, sys
print(sum(1 for p in json.load(sys.stdin) if p.startswith("/extensions/<pack-dir-name>/")))
'
```

Non-zero means the pack patches the frontend at runtime (restyled nodes,
rebuilt widgets, injected page chrome). Write that down - it decides whether
Step 6 needs the CI-parity run. Both "green locally, red on CI" failures in
the first 5-pack onboarding came from exactly this.

## Step 2 - read the pack's real node keys

The manifest's `expectedNodes` are the pack's `object_info` keys (the same
strings the API uses as `class_type`). They are NOT Python class names and
NOT display names. Get them from the running backend:

```bash
curl -s http://127.0.0.1:8288/object_info | python3 -c '
import json, sys
d = json.load(sys.stdin)
for key, node in sorted(d.items()):
    if node.get("python_module") == "custom_nodes.<pack-dir-name>":
        print(key)
'
```

Real traps this step catches (each one shipped in a real pack):

| Pack                   | Correct key         | Wrong guesses that look right                                                   |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------- |
| ComfyUI_essentials     | `SimpleMathInt+`    | `SimpleMathInt` (keys carry a trailing `+`, except `DisplayAny` which has none) |
| ComfyUI-KJNodes        | `INTConstant`       | `INT Constant` (that is the display name)                                       |
| ComfyUI-Custom-Scripts | `ShowText\|pysssss` | `ShowText` (keys carry a `\|pysssss` suffix)                                    |
| rgthree-comfy          | `Seed (rgthree)`    | `RgthreeSeed` (the Python class name)                                           |

## Step 3 - pick the expected nodes

Choose 2-3 nodes that are:

- **Model-free**: no checkpoint / VAE / CLIP inputs, no file downloads. The
  gate runs on CPU with no models installed. Constants, math, text, and
  display nodes are ideal.
- **Wireable into a chain**: at least one producer (has a typed output) and
  one terminal node. A terminal node either has `output_node: true` in
  `/object_info` (it terminates a workflow by itself) or you end the chain in
  the core `PreviewAny` node, which accepts any type.

Check a candidate's inputs, outputs, and `output_node` flag:

```bash
curl -s http://127.0.0.1:8288/object_info | python3 -c '
import json, sys
node = json.load(sys.stdin)["<exact key>"]
print(json.dumps({k: node[k] for k in ("input", "output", "output_name", "output_node")}, indent=1))
'
```

Every node you list in `expectedNodes` must appear in the run workflow: the
run tier asserts each one actually executes on the backend.

## Step 4 - author the run-tier workflow

Add one JSON file under `browser_tests/assets/customNodes/`, named
`<pack>_<what it does>_run.json`. Copy an existing asset as the template
(`rgthree_seed_display_run.json` is the simplest two-node example;
`was_number_text_run.json` shows a 3-node chain). It is the frontend
workflow format, hand-authorable:

- `nodes[].type` is the exact `object_info` key from Step 2.
- `widgets_values` is an array in the node's widget order: the `input`
  entries from `/object_info` in declaration order (`required` first, then
  `optional`), keeping only widget-type inputs (INT, FLOAT, STRING, BOOLEAN,
  and combo lists) and skipping any input whose options say
  `"forceInput": true` (those are sockets, never widgets). A required input
  that is neither a widget type nor `forceInput` (a custom type like
  `NUMBER`) is also a socket: wire a link into it or the run fails on a
  missing required input.
- A link is one row in `links`: `[link_id, from_node_id, from_slot,
to_node_id, to_slot, "TYPE"]`, plus the matching `link`/`links` ids on the
  two nodes' `inputs`/`outputs` entries.
- To wire INTO an input that would normally be a widget (no `forceInput`),
  the input entry also needs a `"widget": { "name": "<input name>" }` key -
  see `browser_tests/assets/vueNodes/linked-int-widget.json`.
- Keep it tiny. Two to four nodes proving "this pack executes" is the whole
  job; feature-depth testing belongs to the pack's own repo.
- If the workflow needs a media file, reuse something already under
  `browser_tests/assets/` (e.g. `plain_video.mp4`) - never commit new binary
  assets. CI stages `plain_video.mp4` into the backend's `input/` dir; if
  your workflow needs a different existing asset staged, extend the
  `Stage run-tier assets` step in
  `.github/workflows/ci-tests-custom-nodes.yaml`.
- A media path in the workflow (e.g. `input/plain_video.mp4`) resolves
  against the backend process's working directory, not the repo. Locally,
  copy the file into the `input/` dir of the directory you launched
  `main.py` from, or the run tier fails validation with
  `Invalid file path` and the test reports `TIMEOUT`.

## Step 5 - add the manifest row

Append one object to `browser_tests/fixtures/data/customNodeManifest.json`:

| Field                | Meaning                                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pack`               | The pack's directory name under `custom_nodes/` (what `git clone` creates).                                                                                                                        |
| `repo`               | The GitHub URL CI clones. Required non-empty.                                                                                                                                                      |
| `pin`                | Commit SHA or tag CI checks out after cloning; `""` = default branch head. Pin when a pack breaks often; `""` also means new upstream regressions surface here first.                              |
| `tiers`              | Which tiers run: `load` (registers + renders in both renderers), `connectivity` (typed links + slot drags), `run` (executes the workflow). Use all three unless a tier is impossible for the pack. |
| `workflow`           | Path relative to `browser_tests/` of the Step 4 file. `""` only while the pack has no `run` tier.                                                                                                  |
| `expectedNodes`      | The Step 2/3 keys. The load tier mounts each in both renderers; the run tier asserts each executes.                                                                                                |
| `requiresGpu`        | `true` only if execution genuinely needs CUDA. Such packs cannot use the `run` tier on the CPU gate.                                                                                               |
| `requiresModels`     | Model files the workflow needs (`[]` for the packs onboarded so far - keep it that way whenever possible).                                                                                         |
| `timeoutMs`          | Per-test budget. `30000` unless the workflow does real work (video decode uses `90000`).                                                                                                           |
| `vueNodesCompatible` | Optional, default `true`. See the policy below. Only ever set `false`, and only with evidence.                                                                                                     |

`loadManifest()` (`browser_tests/fixtures/customNode/manifest.ts`) validates
every row and fails loudly on a missing field, an empty `repo`, a misspelled
tier, or a `run` tier with an empty `workflow`.

## Step 6 - prove it green locally, in both environments

### 6a - fast loop (dev server)

```bash
pnpm test:custom-nodes
```

Green means: every tier for every pack passes, zero skips, and the suite's
zero-visible-errors invariant held (no error overlay, dialog, node error, or
error toast at any point). Iterate here - it is the fastest loop.

### 6b - CI-parity run (required if the pack ships frontend JS)

The dev server never loads pack frontend JS (its `/extensions` list is
core-only), so 6a exercises vanilla nodes. If Step 1 found frontend JS, a
6a green proves nothing about the pack's real runtime behavior. CI serves
the built frontend from the backend, so reproduce that exactly:

```bash
pnpm build
# relaunch the test backend with the same flags plus:
#   --front-end-root <repo>/dist
# and make sure any run-tier media is in that process's input/ dir
PLAYWRIGHT_TEST_URL=http://127.0.0.1:8288 pnpm exec playwright test \
  browser_tests/tests/customNodes/ --config playwright.chrome.config.ts --workers=1
```

Both real failures during the first 5-pack onboarding only existed here:
rgthree's progress bar shifted the canvas and broke slot-drag coordinates,
and rgthree's Seed rebuilt a declared input as widget-only. Skipping 6b
means discovering that class of problem one CI round at a time.

### Failure classes and what they mean

- **T0 fails only in the Vue Nodes pass** (the LiteGraph pass is green):
  suspected Vue Nodes 2.0 incompatibility. Follow the policy below - do not
  delete the pack, do not skip the test.
- **Run tier fails with `PARTIAL`** (some expected nodes never executed):
  either the backend is missing `--cache-none` (cached nodes emit no
  `executing` event) or an expected node is not actually in the workflow.
- **Run tier fails with an execution error**: the workflow JSON is wrong
  (bad key, wrong `widgets_values` order, type-mismatched link) or the pack
  cannot execute model-free. Fix the workflow or drop the node for a
  simpler one.
- **Connectivity reports zero planned pairs**: the pack's slots are all
  wildcard or combo typed (both are excluded from pairing by design because
  they bypass the real type compare). The pack still gets load/run coverage.
- **Connectivity logs `widget-only on instance` exclusions**: the pack's own
  frontend JS rebuilt a declared input as a widget-only control (rgthree's
  Seed does this to `seed`), so there is no socket to wire. Recorded and
  excluded, like wildcards - pack design, not a regression.
- **Auto-run reports a node "not in cannotRunAlone"**: the node failed to
  execute on pure defaults (validation reject, or a real exception from
  degenerate defaults - empty expression, empty folder, no webcam). If the
  node USED to run clean this is a regression; otherwise add it to the
  row's `cannotRunAlone` baseline with the run log in the PR. The check is
  two-way: a listed node that starts running clean fails the suite until
  the stale entry is removed.
- **Auto-run fails with `HUNG_BACKEND`**: a node blocked forever during
  execution (the canonical case downloads a model at runtime and hangs
  without network). The failure names the suspects and the remedy: add the
  offender to `AUTO_RUN_EXCLUDE` in `allNodes.spec.ts` with its mechanism,
  and restart the test backend (the hang is non-interruptible).
- **Mount test fails on console errors**: a pack's JS logged real errors
  while its nodes mounted. If it is pack-attributed noise with no visible
  error surface (KJNodes' loader previews fetching `filename=undefined`),
  add a scoped `CONSOLE_ERROR_ALLOWLIST` entry with the mechanism;
  otherwise it is a finding.

### The exception ledgers (all reasons on the record)

Every escape hatch is a reviewed list whose entries carry the mechanism, so
the gate stays honest and none can grow silently:

| Ledger                       | Lives in               | Covers                                                                                     |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `vueIncompatibleNodes`       | manifest row           | node cannot mount under Vue Nodes 2.0 (evidence rule below)                                |
| `cannotRunAlone`             | manifest row           | node cannot execute standalone on a bare backend; asserted both ways so entries cannot rot |
| `AUTO_RUN_EXCLUDE`           | `allNodes.spec.ts`     | executing the node is unsafe on a bare backend (runtime downloads, hangs)                  |
| `CONSOLE_ERROR_ALLOWLIST`    | `allNodes.spec.ts`     | pack-attributed console noise with no visible error surface                                |
| `CONNECT_REJECTED_ALLOWLIST` | `connectivity.spec.ts` | pack JS legitimately vetoes a planned wiring                                               |
| `ROUNDTRIP_LOST_ALLOWLIST`   | `connectivity.spec.ts` | pack's own serialize/configure drops links it manages itself                               |

## Step 7 - push and watch CI

The `CI: Tests Custom Nodes` job (gating) re-does Steps 1-6 from scratch on
every PR: clones every manifest `repo` at its `pin`, pip-installs under CPU
torch constraints, boots the backend, runs the suite, and fails on any
install error, any test failure, or any skipped test. A new pack row is
automatically picked up; no workflow edit is needed unless you must stage an
extra asset (Step 4).

If CI goes red where local was green, reproduce under the Step 6b
environment before changing anything - the first such failure looked like
upstream drift but was actually pack frontend JS that never loads under
the dev server. Only after 6b reproduces it, decide: adjust the suite's
expectation honestly (the way widget-only instance slots became a recorded
exclusion) or, for genuine upstream drift (`pin: ""` tracks the pack's
default branch head), pin the pack to its last good commit. Never paper
over it with a skip.

## Vue Nodes 2.0 compatibility policy

Some packs only work under the LiteGraph canvas renderer and fail to mount
under Vue Nodes 2.0. The suite must state that fact without producing false
failures and without skipping tests:

1. **Default**: every pack is assumed compatible. New rows omit
   `vueNodesCompatible`.
2. **Evidence rule**: set `"vueNodesCompatible": false` ONLY after the T0
   Vue pass fails for the pack locally while the LiteGraph pass is green,
   and the failure reproduces on a retry. A README grumble, a hunch, or an
   old forum thread is not evidence. Record the evidence (the failing
   assertion and the pack version) in the PR description of the change that
   sets the flag. When only SOME of a pack's nodes fail to mount, use the
   per-node `vueIncompatibleNodes` ledger in the manifest row instead of
   flagging the whole pack - compatibility is per-node, not per-pack (all
   823 nodes across the first 7 packs mount clean, so both mechanisms ship
   unused; the every-node mount tier is what earns an entry).
3. **Effect of `false`**: the load tier runs its LiteGraph pass only, and
   the connectivity drag test does not drag that pack's edges under Vue
   Nodes. The tests still run and pass their canvas assertions - nothing is
   `test.skip`ped, so the CI skip gate stays honest. The run tier and the
   connectivity contract sweep are renderer-independent (they never toggle
   the Vue Nodes setting) and run for the pack regardless of the flag - a
   flagged pack must still execute and wire cleanly there.
4. **Un-flagging**: if a pack ships Vue Nodes support later, delete the flag
   and prove T0 green in both passes locally.

## Checklist

- [ ] Pack installs clean on the test backend (no `IMPORT FAILED`)
- [ ] Checked whether the pack ships frontend JS (Step 1 `/extensions` probe)
- [ ] `expectedNodes` copied exactly from `/object_info` (Step 2 traps checked)
- [ ] All expected nodes are model-free and present in the run workflow
- [ ] Workflow JSON under `browser_tests/assets/customNodes/`, no new binaries
- [ ] Any media staged into the backend's own `input/` dir locally (Step 4)
- [ ] Manifest row appended with every field (Step 5 table)
- [ ] `vueNodesCompatible` omitted, or set `false` with recorded evidence
- [ ] 6a green: `pnpm test:custom-nodes` against the dev server, zero skips
- [ ] 6b green when the pack ships frontend JS: built dist + backend-served run
- [ ] Every-node tiers green: no unexplained mount/save-reload/auto-run
      failures; any new ledger entry carries its mechanism
- [ ] Pushed; `CI: Tests Custom Nodes` green on the PR
