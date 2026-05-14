/**
 * @deprecated Import from `@comfyorg/extension-api` (or `@/extension-api`)
 * instead. This stub will be removed in the next release after PKG2 lands.
 *
 * See `src/extension-api/` for the new source of truth.
 */

// NodeEntityId/WidgetEntityId/SlotEntityId removed from this re-export per D20
// (id-type-convergence) — they are now @internal. Use `node.id` / `widget.id`
// (string) and `node.equals(other)` for the public surface.
export type {
  Point,
  Size,
  NodeMode,
  SlotDirection,
  SlotInfo,
  WidgetHandle,
  WidgetOptions,
  NodeHandle
} from '@/extension-api'

export type { NodeExtensionOptions, ExtensionOptions } from '@/extension-api'

export { defineNode, defineExtension } from '@/extension-api'
