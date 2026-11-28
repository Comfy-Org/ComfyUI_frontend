# Nodes 2.0 acceptance tests

These tests check Nodes 2.0 against the [Acceptance Tests for Nodes 2.0](https://app.notion.com/p/41d6d73d365081dd807ff7e3623109a8) criteria. Input and pack checks compare Litegraph (classic), as the control, with Nodes 2.0. Renderer-specific interactions exercise the same required outcome. The required value is Litegraph's. A missing or failed control yields TEST FAILED, not a Nodes 2.0 pass or fail. Classic layout checks without an independent canvas-rendering oracle are omitted; their subject-only DOM measurements cannot establish parity.

| Project                    | What it tests                                                                                                  | Backend                  | Time    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------ | ------- |
| `nodes2-acceptance`        | Core node inputs: layout, values, events, states, menus                                                        | Core nodes, test build   | ~3 min  |
| `nodes2-acceptance-packs`  | Features of 17 popular custom node packs                                                                       | Pinned packs, prod build | ~9 min  |
| `nodes2-acceptance-layout` | Node types available and registered in the reduced test backend: size, controls, drawing and click differences | Pinned packs, prod build | ~25 min |
| `nodes2-acceptance-perf`   | Load, heap, typing and idle as ratios to Litegraph, and frame times while panning, dragging and zooming        | Core nodes, prod build   | ~9 min  |

All four run on the Classic theme, the closest match to Litegraph's metrics. None of them runs in the gating `chromium` project or in CI.

## Requirements

- A local [ComfyUI](https://github.com/comfyanonymous/ComfyUI) checkout with its Python environment. Last run with ComfyUI `v0.28.0-12-gb08e6cf35`.
- `pnpm install` in this checkout.
- `git`, `curl` and `lsof`, and network access to clone the pinned packs from GitHub.
- Ports 18461, 18462 and 18463 free. Change them with the variables below.

The scripts never write into the ComfyUI checkout or its Python environment. Each backend gets its own folder under `temp/nodes2-acceptance/`. The packs' extra Python modules are installed into `temp/nodes2-acceptance/packs/python-overlay` with `pip install --target`. Packs whose `__init__.py` installs software or imports hundreds of heavy nodes are replaced or patched as listed in `browser_tests/fixtures/data/nodes2AcceptancePacks.json`.

## Run everything

```bash
COMFYUI_DIR=~/ComfyUI scripts/nodes2-acceptance/run.sh
```

This takes about 45 minutes. The script:

1. Builds the test bundle (`pnpm build:test`) and a production bundle. Pack frontends import the legacy `/scripts/app.js` shims, which only the production bundle has.
2. Clones the 17 pinned packs at their pinned commits into `temp/nodes2-acceptance/packs/custom_nodes`. A re-run reuses them.
3. Starts one ComfyUI backend for the inputs tests and one with the packs.
4. Runs the inputs project alongside the packs project, then the layout survey.
5. Stops those backends and runs the performance project on its own, so other work doesn't skew the timings.
6. Prints where the reports are and exits nonzero if any project failed.

Run only some projects, or only some tests:

```bash
NODES2_ACCEPTANCE_PROJECTS="inputs packs" COMFYUI_DIR=~/ComfyUI scripts/nodes2-acceptance/run.sh
NODES2_ACCEPTANCE_PROJECTS=layout NODES2_ACCEPTANCE_GREP=rgthree COMFYUI_DIR=~/ComfyUI scripts/nodes2-acceptance/run.sh
```

| Variable                                                                                       | Default                         | Meaning                                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| `COMFYUI_DIR`                                                                                  | required                        | The ComfyUI checkout to run                                               |
| `COMFYUI_PYTHON`                                                                               | `$COMFYUI_DIR/.venv/bin/python` | Its Python                                                                |
| `NODES2_ACCEPTANCE_PROJECTS`                                                                   | `inputs packs layout perf`      | Which projects to run                                                     |
| `NODES2_ACCEPTANCE_GREP`                                                                       | none                            | Passed to Playwright's `--grep`                                           |
| `NODES2_ACCEPTANCE_RUN`                                                                        | start time plus a unique suffix | Report folder name; give two runs the same name to put them in one folder |
| `NODES2_ACCEPTANCE_VARIANT`                                                                    | none                            | Subfolder of the run, such as `main` or `inflight`                        |
| `NODES2_ACCEPTANCE_BUILD`                                                                      | this checkout's commit          | Label for the frontend under test, shown in the report                    |
| `NODES2_ACCEPTANCE_TEST_BUILD`, `NODES2_ACCEPTANCE_PROD_BUILD`                                 | build from this checkout        | Use existing builds instead, such as another checkout's                   |
| `NODES2_ACCEPTANCE_INPUTS_PORT`, `NODES2_ACCEPTANCE_PACKS_PORT`, `NODES2_ACCEPTANCE_PERF_PORT` | 18461, 18462, 18463             | Backend ports                                                             |
| `NODES2_ACCEPTANCE_WORK_DIR`                                                                   | `temp/nodes2-acceptance`        | Builds, backends and packs                                                |

## Compare two frontends

To test another frontend, such as main with some open PRs merged, build it in its own checkout:

```bash
pnpm build:test
NODE_ENV=production pnpm exec vite build --config vite.config.mts --outDir dist-prod
```

Then run the tests from this checkout against both, with one run name and a variant each:

```bash
export COMFYUI_DIR=~/ComfyUI NODES2_ACCEPTANCE_RUN=compare-inflight
NODES2_ACCEPTANCE_VARIANT=main scripts/nodes2-acceptance/run.sh
NODES2_ACCEPTANCE_VARIANT=inflight NODES2_ACCEPTANCE_BUILD="inflight $(git -C ../other rev-parse --short=10 HEAD)" \
  NODES2_ACCEPTANCE_TEST_BUILD=../other/dist/test NODES2_ACCEPTANCE_PROD_BUILD=../other/dist-prod \
  scripts/nodes2-acceptance/run.sh
```

The tests and the pinned packs come from this checkout; only the frontend under test changes.

## Run one project by hand

Start a backend, then run Playwright against it:

```bash
export COMFYUI_DIR=~/ComfyUI
pnpm exec tsx scripts/nodes2-acceptance/setupPacks.ts --backend temp/nodes2-acceptance/packs --python $COMFYUI_DIR/.venv/bin/python
NODE_ENV=production pnpm exec vite build --config vite.config.mts --outDir temp/nodes2-acceptance/dist-prod
scripts/nodes2-acceptance/serve.sh 18462 temp/nodes2-acceptance/packs temp/nodes2-acceptance/dist-prod $(cat temp/nodes2-acceptance/packs/packs.txt)
PLAYWRIGHT_TEST_URL=http://127.0.0.1:18462 PLAYWRIGHT_SETUP_API_URL=http://127.0.0.1:18462 TEST_COMFYUI_DIR=temp/nodes2-acceptance/packs \
  pnpm exec playwright test --project=nodes2-acceptance-packs --workers=1 --retries=0 \
  --reporter=line,./browser_tests/reporters/nodes2AcceptanceReporter.ts
```

`serve.sh <port> <backend folder> <frontend build> [packs...]` copies `tools/devtools` into the backend and waits for a successful HTTP response from its child process. It rejects occupied ports and live pidfiles without stopping their processes. Failed or interrupted startup stops the child it launched. After successful startup, `kill $(cat <backend folder>/server.pid)` stops that backend. Run one worker per backend.

## Reports

Every run writes to its own folder and never overwrites an earlier one. `nodes2-acceptance-report/index.html` links every run, newest first.

```
nodes2-acceptance-report/
  index.html
  2026-11-23_132840/
    about.txt      optional description shown in the index
    report.html    one row per requirement in the criteria document
    layout.html    the layout survey's flagged nodes, with Litegraph and Nodes 2.0 screenshots
    data/          results per project, as JSON; the report is rebuilt from these
    layout/        survey data and screenshots
    logs/          build and Playwright output
```

In `report.html`:

- **PASS**: Nodes 2.0 meets the requirement.
- **FAIL**: Nodes 2.0 does not; the result column shows the measured value.
- **TEST FAILED**: required results are missing, the Litegraph control failed, the test timed out, or attempts disagreed across retries or repeated runs. The row says nothing about Nodes 2.0.
- **NOT TESTED**: there is no reliable test for the requirement yet; the row says why.

In `layout.html`, each flag is a measurement against Litegraph. Use the screenshots to confirm it:

- **Too big, Too small**: the node's size on screen differs from Litegraph's by more than half, or shrinks by more than a fifth.
- **Control hidden, Control covered**: a control Litegraph shows is missing, or another node element covers it.
- **Drawing clipped**: a canvas widget draws outside the strip Nodes 2.0 gives it.
- **Content cut off**: a widget row extends past the node's edge.
- **Node drawing missing**: the pack's node draw hook paints on Litegraph, and Nodes 2.0 never calls it and shows nothing similar there.
- **Control does nothing, Control behaves differently**: the same click changes something on Litegraph and nothing, or something else, on Nodes 2.0.

## Changing the tests

- Requirements and their tests are matched in `browser_tests/reporters/nodes2Acceptance/requirements.ts`; a requirement with no test is listed as NOT TESTED.
- To pin a pack at a new commit, change it in `nodes2AcceptancePacks.json` and run `setupPacks.ts` again.
- Performance numbers depend on the machine. The ratio checks compare Nodes 2.0 with Litegraph in the same session, so they hold up across machines better than the frame-time limits do.
- The manual perf project fails on either ratio or absolute-frame assertions. A future ratio-only CI gate must invoke `playwright test performance.ratios.spec.ts --project=nodes2-acceptance-perf`; collect `performance.frames.spec.ts` separately as report-only evidence rather than using the whole project's exit status.
- An external `NODES2_ACCEPTANCE_REPORT_DIR` gets its own `index.html` beside its reports; the default run index only lists reports inside its own root. Grouped sections retain their build and completion time. Results from another build remain visible as historical evidence but are excluded from current totals.
