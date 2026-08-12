# Vitest Setup Consolidation

Read this reference only for Vitest or comparable in-process unit-test runners.

## Sources of Truth

Read the active Vitest configuration, every setup file in its `setupFiles`
chain, package-specific configurations, and the repository's unit-test guidance.
In this repository, start with:

- `vite.config.mts`
- `vitest.setup.ts` and `vitest.timer.setup.ts`
- package-local Vitest configuration and setup
- `docs/guidance/vitest.md`
- `docs/testing/vitest-patterns.md`

Confirm behavior against the installed Vitest version. Do not infer current
defaults from memory or older documentation.

## Ownership Model

Prefer native configuration for lifecycle behavior the runner already supports.
Use global setup hooks only for invariants that configuration cannot express.
Keep package-specific behavior in the narrowest package setup instead of the
repository-wide environment.

For each candidate, distinguish:

- runner-managed reset behavior
- mutable environment state requiring fresh setup
- process-wide modes requiring restoration
- scenario-specific state that must remain local

Configuration and setup hooks compose. Read the complete chain before deciding
that a local call is redundant.

## Defaults and Exceptions

A global default must be valid for every test in its scope. Determine the common
behavior empirically and identify suites that intentionally opt out or establish
a different state.

Setup belongs before each test when state must be fresh. Restoration belongs
after each test when a process-wide mode can leak. Avoid adding both when the
runner already guarantees one side of the contract.

When standardizing time or another deterministic baseline, preserve tests where
the absolute value is part of the behavior. Prefer relative expectations only
when they improve intent.

## Mocks and Modules

Runner-level mock reset and restoration can change module-scope test doubles.
Verify whether defaults survive reset and whether suites intentionally reprogram
mocks during a test.

Share substantial equivalent module mocks only when the extraction reduces
reader load and preserves observable behavior. Keep assertion handles explicit.
Check module re-evaluation and reset behavior: a shared mock that recreates
state can break identity held by an importing test.

Do not extract a mock when the typed shared implementation is no simpler than
the local versions or requires new global mutable indirection.

## Migration Method

For one lifecycle responsibility at a time:

1. Count and classify local occurrences.
2. Remove them experimentally without adding a replacement.
3. Use failures to determine the actual contract and exceptions.
4. Prefer native configuration, then the narrowest setup file.
5. Remove only calls made redundant by the new owner.
6. Preserve mid-test resets and state that defines the scenario.

Independent suites can be evaluated in parallel by subagents. Require each to
report observed necessity and exceptions rather than merely editing the file.

## Proof

Run directly affected files first, then setup-contract tests and the complete
unit suite. Run the repository's static checks.

Profile before and after when new logic executes for every test. Use comparable
multi-sample runs and report variance; do not interpret normal run-to-run noise
as a performance change.

The full-suite result is required because shared process state can fail only
under concurrency or interaction with unrelated suites.
