# 7. NodeExecutionOutput Passthrough Schema Design

Date: 2026-03-11

## Status

Accepted

## Context

`NodeExecutionOutput` represents the output data from a ComfyUI node execution. The backend API is intentionally open-ended: custom nodes can output any key (`gifs`, `3d`, `meshes`, `point_clouds`, etc.) alongside the well-known keys (`images`, `audio`, `video`, `animated`, `text`).

The Zod schema uses `.passthrough()` to allow unknown keys through without validation:

```ts
const zOutputs = z
  .object({
    audio: z.array(zResultItem).optional(),
    images: z.array(zResultItem).optional(),
    video: z.array(zResultItem).optional(),
    animated: z.array(z.boolean()).optional(),
    text: z.union([z.string(), z.array(z.string())]).optional()
  })
  .passthrough()
```

This means unknown keys are typed as `unknown` in TypeScript, requiring runtime validation when iterating over all output entries (e.g., to build a unified media list).

### Why not `.catchall(z.array(zResultItem))`?

`.catchall()` correctly handles this at the Zod runtime level — explicit keys override the catchall, so `animated: [true]` parses fine even when the catchall expects `ResultItem[]`.

However, TypeScript's type inference creates an index signature `[k: string]: ResultItem[]` that **conflicts** with the explicit fields `animated: boolean[]` and `text: string | string[]`. These types don't extend `ResultItem[]`, so TypeScript errors on any assignment.

This is a TypeScript limitation, not a Zod or schema design issue. TypeScript cannot express "index signature applies only to keys not explicitly defined."

### Why not remove `animated` and `text` from the schema?

- `animated` is consumed by `isAnimatedOutput()` in `litegraphUtil.ts` and by `litegraphService.ts` to determine whether to render images as static or animated. Removing it would break typing for the graph editor path.
- `text` is part of the `zExecutedWsMessage` validation pipeline. Removing it from `zOutputs` would cause `.catchall()` to reject `{ text: "hello" }` as invalid (it's not `ResultItem[]`).
- Both are structurally different from media outputs — they are metadata, not file references. Mixing them in the same object is a backend API constraint we cannot change here.

## Decision

1. **Keep `.passthrough()`** on `zOutputs`. It correctly reflects the extensible nature of the backend API.

2. **Use `resultItemType` (the Zod enum) for `type` field validation** in the shared `isResultItem` guard. We cannot use `zResultItem.safeParse()` directly because the Zod schema marks `filename` and `subfolder` as `.optional()` (matching the wire format), but a `ResultItemImpl` needs both fields to construct a valid preview URL. The shared guard requires `filename` and `subfolder` as strings while delegating `type` validation to the Zod enum.

3. **Accept the `unknown[]` cast** when iterating passthrough entries. The cast is honest — passthrough values genuinely are `unknown`, and runtime validation narrows them correctly.

4. **Centralize the `NodeExecutionOutput → ResultItemImpl[]` conversion** into a shared utility (`parseNodeOutput` / `parseTaskOutput` in `src/stores/resultItemParsing.ts`) to eliminate duplicated, inconsistent validation across `flattenNodeOutput.ts`, `jobOutputCache.ts`, and `queueStore.ts`.

## Consequences

### Positive

- Single source of truth for `ResultItem` validation (shared `isResultItem` guard using Zod's `resultItemType` enum)
- Consistent validation strictness across all code paths
- Clear documentation of why `.passthrough()` is intentional, preventing future "fix" attempts
- The `unknown[]` cast is contained to one location

### Negative

- Manual `isResultItem` guard is stricter than `zResultItem` Zod schema (requires `filename` and `subfolder`); if the Zod schema changes, the guard must be updated manually
- The `unknown[]` cast remains necessary — cannot be eliminated without a TypeScript language change or backend API restructuring

## Notes

The backend API's extensible output format is a deliberate design choice for ComfyUI's plugin architecture. Custom nodes define their own output types, and the frontend must handle arbitrary keys gracefully. Any future attempt to make the schema stricter must account for this extensibility requirement.

If TypeScript adds support for "rest index signatures" or "exclusive index signatures" in the future, `.catchall()` could replace `.passthrough()` and the `unknown[]` cast would be eliminated.
