---
name: consolidating-test-setup
description: Consolidates repeated test setup and teardown into the narrowest shared lifecycle owner. Use when test files repeat initialization, cleanup, environment management, fixtures, or equivalent test doubles.
---

# Consolidating Test Setup

Move repeated test plumbing to the narrowest shared owner that can provide it
reliably, leaving individual test files focused on behavior.

## Core Principles

### Repetition is evidence, not proof

Repeated code may encode distinct requirements. Group candidates by behavior,
lifecycle, and defaults before treating them as duplicates.

### Centralize invariants, not scenarios

Shared setup should establish conditions that are true for every test in its
scope. Data or state that explains a particular scenario belongs near that
scenario.

### Put responsibility at its natural boundary

Prefer the mechanism that already owns the lifecycle. Use test-runner
configuration before global hooks, scoped fixtures before broad globals, and
local setup when the requirement is local. Wider reuse is not automatically
better reuse.

### Defaults need boundaries and escape hatches

A shared default should be deterministic, isolated, and easy to override when a
test intentionally needs different behavior. An exception should remain local
without weakening isolation elsewhere.

### Setup and teardown form one contract

Define when state is created, how long it lives, and who releases it. Teardown
must be complete, idempotent where practical, and awaited when asynchronous.
No test should depend on execution order or cleanup performed by another test.

### Subtract before abstracting

First remove suspected cargo-cult setup and run the affected tests. If nothing
breaks, delete it. If behavior depends on it, use the failure to identify the
actual contract before choosing a shared design.

### An abstraction must own something

A helper that only relocates or renames several lines is not a useful boundary.
Centralization should encode a stable policy, own a coherent lifecycle, or
materially reduce duplication and reader effort.

### Preserve behavioral visibility

Tests should still reveal the conditions relevant to the behavior under test.
Do not hide meaningful scenario setup behind a universal fixture merely to make
files shorter.

### Change one lifecycle responsibility at a time

Separating concerns makes regressions attributable and alternatives comparable.
Prove each centralization independently before combining broader changes.

### Existing setup may encode a regression fix

Before removing synchronization or cleanup from an existing test, inspect its
history. Preserve the guarantee when the code was introduced to prevent a race,
leak, or order dependency, even if the implementation can be improved.

## Load Runner-Specific Guidance

After identifying the test runner, read only the relevant reference:

- For Vitest or similar in-process unit tests, read
  [`reference/vitest.md`](reference/vitest.md).
- For Playwright or similar browser tests, read
  [`reference/playwright.md`](reference/playwright.md).

Do not load both unless the task spans both runners. The references supplement
the repository's canonical guidance; they do not replace it.

## Workflow

### 1. Discover

Inspect test-runner configuration, setup files, fixtures, helpers, and test
guidance. Inventory repeated lifecycle behavior and count its affected suites.

### 2. Classify

For each candidate, determine:

- the state it owns
- its required lifetime and scope
- whether it is an invariant or scenario detail
- whether differences between suites are intentional
- whether the framework already provides the behavior

### 3. Challenge

Remove the candidate setup and run all affected tests. Classify the result as
unnecessary, universally required, commonly required with exceptions, or
suite-specific.

When many suites are independent, subagents may evaluate disjoint groups. Each
must report observed behavior and exceptions; the parent agent retains the
design and integration decision.

### 4. Place

Choose the narrowest owner capable of enforcing the contract consistently:

1. native test-runner behavior
2. shared setup matching the resource's lifetime
3. a test-scoped fixture or lifecycle hook
4. a focused harness, factory, or test double
5. the individual suite

Move down the list only when the preceding boundary cannot express the required
behavior cleanly.

### 5. Migrate

Introduce the shared behavior, then remove only the local code it supersedes.
Retain intentional exceptions and behavior-establishing setup. Avoid unrelated
test rewrites while changing lifecycle ownership.

### 6. Prove

Validate from narrowest to broadest:

- affected tests
- tests of the shared lifecycle itself
- static checks required by the repository
- the complete relevant test suite

Measure before and after when the new behavior runs for every test or may affect
suite performance. Use multiple comparable samples and distinguish signal from
normal variance.

## Reporting

Report:

- the repeated contract and its scope
- why the selected owner is the narrowest correct boundary
- alternatives rejected
- intentional exceptions retained
- duplication removed
- targeted and complete validation
- performance evidence when applicable

## Guardrails

- Do not equate repetition with redundancy; prove it.
- Do not replace native test-runner behavior with a custom abstraction.
- Do not centralize scenario-specific behavior as an environment invariant.
- Do not widen setup from a package to the entire repository without evidence.
- Do not add fixtures, helpers, or mocks merely to move the same amount of code.
- Do not hide global mutable state behind helper indirection.
- Do not trade visible test intent for shorter files.
- Do not claim success from targeted tests alone when the lifecycle is shared.
