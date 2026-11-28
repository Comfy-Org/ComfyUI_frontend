---
name: writing-playwright-tests
description: 'Writes Playwright e2e tests for ComfyUI_frontend. Use when creating, modifying, or debugging browser tests. Triggers on: playwright, e2e test, browser test, spec file.'
---

# Writing Playwright Tests for ComfyUI_frontend

1. Read `docs/guidance/testing-principles.md` and confirm the behavior needs an
   E2E test rather than a lower-level one.
2. Read `docs/guidance/playwright.md`. It holds every Playwright convention:
   structure, selectors, Vue Nodes, canvas timing, tags, settings, typed mocks,
   screenshots, flake patterns, and gotchas. Its test-structure example is the
   starting template.
3. Search `browser_tests/tests/` for a spec that covers similar behavior, and
   read the fixture code it uses in `browser_tests/fixtures/`. The fixture code
   is the source of truth for available helpers.
4. Pick tags: the project-routing table in `docs/guidance/playwright.md`, plus
   area tags from `pnpm comfy-test tags`.
5. Start the backend and dev server and run the spec as described in
   `browser_tests/README.md` (Setup, Running Tests).

For a flaky test, use the `hardening-flaky-e2e-tests` skill. For raw
Playwright codegen output, use the `codegen-transform` skill.
