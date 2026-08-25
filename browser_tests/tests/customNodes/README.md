# Custom-node regression suite - spec directory

This directory holds the suite's Playwright specs, fixtures live in
`browser_tests/fixtures/customNode/`, and the break patches for the
detection-proof branch live in `detection-proof/`.

All documentation - architecture, scope and milestones, running locally,
pack onboarding, and the detection proof - lives in the Technical Design
Doc: [docs/custom-node-regression-suite.md](../../../docs/custom-node-regression-suite.md).

Quick start: `pnpm test:custom-nodes:local`.

## Pinned inputs and refresh

The gating workflow loads
[`customNodeManifest.cloud.json`](../../fixtures/data/customNodeManifest.cloud.json).
It records the exact private Cloud repository commit and YAML path used to
build the population. Git packs use full commit SHAs; registry packs use exact
published versions; ComfyUI core is pinned in `ci-tests-custom-nodes.yaml`.

Refreshing the Cloud population is deliberate because the generated node
counts and sentinels must come from the same deployment as the source YAML:

1. Replace `data/cloud/supported_nodes.yaml` from the reviewed Cloud commit and
   update its `# Source` and `# Imported` headers.
2. Capture `/object_info` from that Cloud deployment.
3. Run `pnpm gen:cloud-manifest <object-info-snapshot.json>`.
4. Run the local CPU gate and review every count, extension, applicability, and
   exact-failure delta before merging.

The generator validates source provenance and deploy refs, joins YAML packs to
their runtime directory identities, and preserves the reviewed run-tier
workflow, runnable count, extension sentinels, and cannot-run calibration. It
does not claim to monitor the private Cloud repository automatically.
