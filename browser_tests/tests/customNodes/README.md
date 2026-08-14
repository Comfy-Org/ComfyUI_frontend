# Custom-node regression suite - spec directory

This directory holds the suite's Playwright specs, fixtures live in
`browser_tests/fixtures/customNode/`, and the break patches for the
detection-proof branch live in `detection-proof/`.

All documentation - architecture, scope and milestones, running locally,
pack onboarding, and the detection proof - lives in the Technical Design
Doc: [docs/custom-node-regression-suite.md](../../../docs/custom-node-regression-suite.md).

Quick start: `pnpm test:custom-nodes:local`.

## Pack pins

Every pack is installed at a fixed commit, checked in as `pin` in
[`customNodeManifest.core.json`](../../fixtures/data/customNodeManifest.core.json)
alongside `pinnedAt`, the date it was last verified. ComfyUI core is pinned
the same way, via `comfyui_ref` in `ci-tests-custom-nodes.yaml`.

This is what stops a pack author's push from redding an unrelated PR.
Unpinned, all six pack maintainers are effectively committers to this repo's
CI. The cost is the mirror image - pack breakage is invisible between bumps -
so bumping is a deliberate, reviewed act rather than something that happens to
you.

```bash
pnpm custom-node-pins          # age of each pin, and whether upstream moved
pnpm custom-node-pins:update   # rewrite every pin to upstream HEAD
```

Or run [`update-custom-node-pins.yaml`](https://github.com/Comfy-Org/ComfyUI_frontend/actions/workflows/update-custom-node-pins.yaml)
(`workflow_dispatch`), which does the same thing and opens the PR.

Every suite run reports pin age and warns past **30 days**. It never fails on
staleness alone: blocking every PR over a pin nobody's diff touched is how a
gate gets routed around.

**A bump is expected to red the suite, and that is the point.**
`expectedNodeCount` and `expectedExtensions` are calibrated against the pinned
source, and the manifest is deliberate that any delta - either direction -
fails until it is recalibrated. A red on a bump PR is the suite telling you
what changed in the ecosystem since the last one. A red anywhere else means
the diff did it. Keeping those two apart is the entire reason to pin.
