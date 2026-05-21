# Extension API v2 — test harness

Shared test utilities for `src/extension-api-v2/__tests__/`. Each module
here replaces a specific copy-pasted block from the BC.\* test files.

## What lives here

| Module                             | Replaces                                              | Status                        |
| ---------------------------------- | ----------------------------------------------------- | ----------------------------- |
| [`v2Runtime.ts`](./v2Runtime.ts)   | inline `createTestRuntime` / `createV2Runtime` blocks | adopted by bc-01.\*           |
| [`v1App.ts`](./v1App.ts)           | inline `createV1App` shims in `*.migration.test.ts`   | adopted by bc-01.migration    |
| [`worldMocks.ts`](./worldMocks.ts) | duplicated `vi.mock('@/world/...')` blocks            | adopted by bc-05.\*, bc-11.\* |

## Migration status

Adoption is intentionally incremental — landing the harness alongside a
single representative BC file keeps each follow-up PR small and easy to
review.

| Surface               | Total files | Migrated                      | Remaining |
| --------------------- | ----------- | ----------------------------- | --------- |
| `createV2Runtime`     | ~96         | 2 (bc-01.v2, bc-01.migration) | ~94       |
| `createV1App`         | ~30         | 1 (bc-01.migration)           | ~29       |
| world `vi.mock` block | 4           | 4 (bc-05.\*, bc-11.\*)        | 0         |

Sweep planned in a follow-up PR (`ext-api/i-tf-harness-rollout`); do
**not** block on it for new BC files — opt them into the shared harness
on the way in.

## Conventions for new harness modules

- Keep the public surface narrow: export only what at least one BC file
  uses today.
- Stay framework-pure (no Vue / Pinia / network). The harness mirrors
  service contracts; it does **not** reach into product code.
- `vi.hoisted(...)` factories must be inlined at the call site — they
  run before module imports resolve, so they cannot reference imported
  helpers from this directory.
- `vi.mock(path, factory)` factories _can_ reference imported helpers,
  but only via an arrow wrapper (`() => helper()`) — passing a bare
  identifier crashes because the second argument is evaluated at
  hoist time before the import binds.
