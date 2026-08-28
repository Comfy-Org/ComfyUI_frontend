# Vitest setup consolidation

Use this reference for Vitest and similar in-process unit-test runners.

## Read first

Read the active Vitest configuration, its full `setupFiles` chain, package-level
overrides, and the repository's unit-test guidance. In this repository, inspect:

- `vite.config.mts`
- `vitest.setup.ts` and `vitest.timer.setup.ts`
- package-level Vitest configuration and setup
- `docs/guidance/vitest.md`
- `docs/testing/vitest-patterns.md`

Check behavior against the installed Vitest version. Defaults change, and setup
files compose.

## Place the responsibility

Use native configuration for lifecycle behavior Vitest already supports. Use a
setup file only for invariants configuration cannot express. Keep package-only
behavior out of repository-wide setup.

Separate runner-managed resets, fresh mutable state, process-wide modes that
need restoration, and scenario state that must remain local. Add hooks only for
the part of the contract Vitest does not already own.

A global default must fit every test in scope. Find the common behavior from the
tests, then preserve deliberate opt-outs. When choosing a deterministic
baseline, keep absolute values local when the value itself is under test.

## Handle mocks carefully

Runner-level reset and restoration can change module-scope test doubles. Check
whether their default implementations survive and whether tests reprogram them
during a scenario.

Share a module mock only when it reduces reader effort and preserves behavior.
Keep assertion handles explicit. Test module re-evaluation because it can replace
shared mock state while a test still holds the old identity.

Keep test-specific `vi.mock` calls in the test module. A call inside an imported
helper is not hoisted ahead of that test module's static imports. For shared
implementations, use `__mocks__` with a local `vi.mock`. For runtime selection,
call `vi.doMock` before a subsequent dynamic import.

Check whether a setup file imports the mock target, directly or transitively.
Vitest cannot replace that cached module. Prefer removing the setup import. If it
is unavoidable, call `vi.resetModules()` inside `vi.hoisted` before the test
imports the target, and account for setup and test code holding different module
instances.

Skip the extraction if typed shared code is no simpler than the local mocks or
needs global mutable indirection.

## Migrate

Work on one lifecycle responsibility at a time:

1. Count and classify local occurrences.
2. Remove them without adding a replacement.
3. Use failures to find the contract and exceptions.
4. Prefer configuration, then the narrowest setup file.
5. Remove only calls the new owner makes redundant.
6. Keep mid-test resets and scenario state local.

Subagents may check independent suites, but each must report observed necessity
and exceptions.

## Prove

Run affected files, setup-contract tests, static checks, and the complete unit
suite. Shared process state can fail only when unrelated suites run together.

Profile changes that execute for every test. Compare several equivalent runs and
report variance instead of treating normal noise as a result.
