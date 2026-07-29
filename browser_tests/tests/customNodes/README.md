# Custom-node regression suite - spec directory

This directory holds the suite's Playwright specs, fixtures live in
`browser_tests/fixtures/customNode/`, and the break patches for the
detection-proof branch live in `detection-proof/`.

All documentation - architecture, scope and milestones, running locally,
pack onboarding, and the detection proof - lives in the Technical Design
Doc: [docs/custom-node-regression-suite.md](../../../docs/custom-node-regression-suite.md).

Quick start: `pnpm test:custom-nodes:local` (core) or
`pnpm test:custom-nodes:local:cloud` (cloud).
