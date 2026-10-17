# ADR-DEVEX-BUILD-0011: Declaration-backed workspace leaves

Date: 2026-10-17

## Status

Proposed

## Context

Workspace separation does not isolate compilation when consumers resolve package
source. We want implementation edits to remain local to a package while public
type changes invalidate consumers. Runtime source consumption remains useful for
Vite development and existing test instrumentation.

The initial pilot exposed an incremental-build limitation in the native TypeScript
bridge: unchanged declaration builds repeatedly reported pending emit work.
Stock TypeScript skipped those unchanged builds. The bridge remains useful for
Vue-aware application checks, so replacing it everywhere would discard that benefit.

## Decision

Use composite declaration-only projects for isolated TypeScript packages. Consumers
resolve emitted declarations through the package's `types` export condition while
runtime tools continue to resolve source. Build declarations before checking
consumers, including on a fresh install.

Run declaration builds through the explicitly resolved stock TypeScript compiler.
Keep native-bridge checks and declaration builds on separate build-info files.
An ambiguous `tsc` executable is insufficient because both installed compilers
provide that binary name.

Extract existing behavior before narrowing interfaces. A domain record is an
ownership classification, not a requirement to create another package. Prefer
packages around shared document contracts over individual technical helpers.

## Alternatives

- Source-only exports preserve ownership boundaries but still include implementations
  in consumer programs.
- Built JavaScript exports would add a runtime build requirement without being
  necessary for typecheck isolation.
- Native-bridge declaration builds emitted usable declarations in the pilot but
  did not reliably skip unchanged work.

## Consequences

Fresh installs and typecheck commands must prepare declaration outputs. Direct
compiler invocations outside those entry points require the same preparation.
Source aliases that bypass a package export also bypass its compilation boundary.

This establishes a mechanism for incremental reuse, not a guaranteed whole-app
speedup. Expansion depends on measured cold and incremental checking costs.
