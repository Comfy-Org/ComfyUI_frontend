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

Run declaration builds with stock TypeScript. Leaf packages declare TypeScript
locally and use its `tsc` executable directly for builds and plain TypeScript checks.
Keep native-bridge checks and declaration builds on separate build-info files.
At the workspace root, select stock TypeScript explicitly because both installed
compilers provide the `tsc` binary name.

Extract existing behavior before narrowing interfaces. A domain record is an
ownership classification, not a requirement to create another package. Prefer
packages around shared document contracts over individual technical helpers.

Use wildcard subpath exports for the layer-editor extraction for now, keeping
explicit mappings for directory entry points. This avoids maintaining a file-by-file
allowlist while preserving existing imports and declaration-backed type resolution.
It deliberately allows imports of implementation and test files. In a follow-up,
replace the wildcard with a small set of capability-level entry points, potentially
using package-level `index.ts` barrels, and migrate consumers to those entry points.
Compilation isolation comes first; a narrower public interface follows separately.

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
