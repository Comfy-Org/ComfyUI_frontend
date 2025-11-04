# Public API Changelog

This changelog documents changes to the ComfyUI Frontend public API surface across versions. The public API surface includes types, interfaces, and objects used by third-party extensions and custom nodes.

**Important**: This is an automatically generated changelog based on TypeScript type definitions. Breaking changes are marked with ⚠️.

## What is tracked

This changelog tracks changes to the following public API components exported from `@comfyorg/comfyui-frontend-types`:

- **Type Aliases**: Type definitions used by extensions
- **Interfaces**: Object shapes and contracts
- **Enums**: Enumerated values
- **Functions**: Public utility functions
- **Classes**: Exported classes and their public members
- **Constants**: Public constant values

## Migration Guide

When breaking changes occur, refer to the specific version section below for:
- What changed
- Why it changed (if applicable)
- How to migrate your code

---

<!-- Automated changelog entries will be added below -->
## v1.31.1 (2025-11-04)

Comparing v1.32.1 → v1.31.1. This changelog documents changes to the public API surface that third-party extensions and custom nodes depend on.

### ⚠️ Breaking Changes

**Type Aliases**

- **Removed**: `WorkflowOpenSource`

**Interfaces**

- **Removed**: `WorkflowImportMetadata`

### 🔄 Modifications

> **Note**: Some modifications may be breaking changes.

**Classes**

- `ComfyApp`
  - ⚠️ **Breaking**: Method `loadGraphData()` signature changed
  - ⚠️ **Breaking**: Method `handleFile()` signature changed

---

