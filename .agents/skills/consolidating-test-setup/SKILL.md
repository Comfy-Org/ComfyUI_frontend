---
name: consolidating-test-setup
description: Consolidates repeated test setup and teardown into the narrowest shared lifecycle owner. Use when test files repeat initialization, cleanup, environment management, fixtures, or equivalent test doubles.
---

# Consolidating test setup

Move repeated test plumbing to the narrowest shared owner that can provide it
reliably. Keep test files focused on behavior.

## Principles

### Prove the code is equivalent

Repetition is evidence, not proof. Similar code may use different defaults,
ordering, or lifetimes. Group candidates by behavior before treating them as
duplicates.

### Centralize invariants, not scenarios

Shared setup should establish conditions that hold for every test in its scope.
State that explains one scenario belongs with that scenario.

### Use the narrowest owner

Prefer the mechanism that already owns the lifecycle. Use runner configuration
before hooks, scoped fixtures before global setup, and local setup for local
requirements. Wider reuse is not better reuse.

### Treat setup and teardown as one contract

Define who creates state, how long it lives, and who releases it. Cleanup must
finish even when a test fails. Tests must not depend on execution order or on
another test's cleanup.

A shared default should be deterministic and easy to override. Local exceptions
must not weaken isolation elsewhere.

### Subtract before abstracting

Remove suspected cargo-cult setup and run the affected tests. A targeted pass
only marks it provisionally unnecessary. Delete it after the complete relevant
suite and runner-specific lifecycle checks pass. If a test fails, use the
failure to identify the contract before designing shared setup.

A helper must own a policy or lifecycle, or remove meaningful reader effort.
Moving the same lines behind a new name is not an improvement.

### Preserve test intent

Do not hide state that matters to the behavior under test. Check history before
removing synchronization or cleanup because it may guard a past regression.
Preserve that guarantee even if the implementation changes.

## Runner-specific guidance

Load only the reference for the runner in use:

- [`reference/vitest.md`](reference/vitest.md) for Vitest and similar
  in-process unit-test runners
- [`reference/playwright.md`](reference/playwright.md) for Playwright and
  similar browser-test runners

These references supplement the repository's testing guide. They do not replace
it. Load both only when the task spans both runners.

## Workflow

### 1. Discover

Read the runner configuration, setup files, fixtures, helpers, and test guidance.
Count repeated lifecycle behavior and note the suites that use it.

### 2. Classify

For each candidate, record:

- the state it owns
- its lifetime and scope
- whether it is an invariant or scenario detail
- intentional differences between suites
- behavior already supplied by the runner

### 3. Challenge

Remove the candidate and run every affected suite. Classify it as unnecessary,
universal, common with exceptions, or suite-specific.

Subagents may evaluate disjoint groups of suites. Require evidence and exception
reports from each. Keep the design and integration decision in the parent task.

### 4. Place

Choose the required lifetime and scope first. Then use the simplest owner at
that exact boundary:

- native runner behavior that supports the required scope
- existing shared setup, fixture, or hook
- a focused helper or test double
- the individual suite

Do not move state to a broader owner because its mechanism appears earlier in
the list.

### 5. Migrate

Move one responsibility at a time. Add the shared owner, then remove only the
local code it replaces. Keep intentional exceptions and scenario setup visible.
Avoid unrelated test rewrites.

### 6. Prove

Run affected tests, tests of the shared lifecycle, repository static checks, and
the complete relevant suite. Measure before and after when the new behavior runs
for every test. Use enough comparable samples to separate a real change from
normal variance.

## Report

State the repeated contract, its new owner, retained exceptions, rejected
alternatives, duplication removed, and validation results. Include performance
evidence when shared setup could affect suite runtime.

## Guardrails

- Do not replace native runner behavior with a custom abstraction.
- Do not widen setup scope without evidence.
- Do not add a helper merely to move code.
- Do not hide global mutable state behind helper indirection.
- Do not trade visible test intent for shorter files.
- Do not trust targeted tests alone after changing shared lifecycle behavior.
