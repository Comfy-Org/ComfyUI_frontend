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
## v1.32.1 (2025-11-05)

Comparing v1.32.0 → v1.32.1. This changelog documents changes to the public API surface that third-party extensions and custom nodes depend on.

### 🔄 Modifications

> **Note**: Some modifications may be breaking changes.

**Interfaces**

- [`ComfyCommand`](https://github.com/Comfy-Org/ComfyUI_frontend/blob/f844d3e95b52501b308aa399e3765f9ed79918cc/src/stores/commandStore.ts#L10)
  - ⚠️ **Breaking**: Member `function` type changed: `() => void | Promise<void>` → `(metadata?: Record<string, unknown>) => void | Promise<void>`
- [`TemplateInfo`](https://github.com/Comfy-Org/ComfyUI_frontend/blob/f844d3e95b52501b308aa399e3765f9ed79918cc/src/platform/workflow/templates/types/template.ts#L1)
  - ✨ Added member: `openSource`

**Classes**

- [`ComfyApp`](https://github.com/Comfy-Org/ComfyUI_frontend/blob/f844d3e95b52501b308aa399e3765f9ed79918cc/src/scripts/app.ts#L123)
  - ⚠️ **Breaking**: Method `loadGraphData()` signature changed
  - ⚠️ **Breaking**: Method `handleFile()` signature changed
- [`LGraphCanvas`](https://github.com/Comfy-Org/ComfyUI_frontend/blob/f844d3e95b52501b308aa399e3765f9ed79918cc/src/lib/litegraph/src/LGraphCanvas.ts#L250)
  - ⚠️ **Breaking**: Method `processMouseDown()` signature changed

---

