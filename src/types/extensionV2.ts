/**
 * @deprecated Import from `@comfyorg/extension-api` (or `@/extension-api`)
 * instead. This stub will be removed in the next release after PKG2 lands.
 *
 * See `src/extension-api/` for the new source of truth.
 */

export type {
  NodeEntityId,
  WidgetEntityId,
  SlotEntityId,
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
