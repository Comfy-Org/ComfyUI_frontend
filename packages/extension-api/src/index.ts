/**
 * @comfyorg/extension-api — Public Extension API for ComfyUI
 *
 * This is the package entry point compiled to `build/index.js` + `build/index.d.ts`.
 * It re-exports the stable public contract from `src/extension-api/` in the main app.
 *
 * All types and functions exported here are part of the semver-stable surface.
 * Do not add internal implementation details to this barrel.
 */

// Re-export everything from the canonical source in the main app tree.
// The tsconfig.json paths alias @/* → ../../src/* so these resolve correctly.
export type {
  ExtensionOptions,
  NodeExtensionOptions,
  WidgetExtensionOptions
} from '@/extension-api/lifecycle'

export {
  defineExtension,
  defineNodeExtension,
  defineWidgetExtension,
  onNodeMounted,
  onNodeRemoved
} from '@/extension-api/lifecycle'

export type {
  NodeHandle,
  NodeEntityId,
  SlotEntityId,
  SlotInfo,
  SlotDirection,
  NodeMode,
  Point,
  Size,
  NodeExecutedEvent,
  NodeConnectedEvent,
  NodeDisconnectedEvent,
  NodePositionChangedEvent,
  NodeSizeChangedEvent,
  NodeModeChangedEvent,
  NodeBeforeSerializeEvent
} from '@/extension-api/node'

export type {
  WidgetHandle,
  WidgetEntityId,
  WidgetValue,
  WidgetOptions,
  WidgetValueChangeEvent,
  WidgetOptionChangeEvent,
  WidgetPropertyChangeEvent,
  WidgetBeforeSerializeEvent,
  WidgetBeforeQueueEvent
} from '@/extension-api/widget'

export type { Handler, AsyncHandler, Unsubscribe } from '@/extension-api/events'

export type {
  SidebarTabExtension,
  BottomPanelExtension,
  VueExtension,
  CustomExtension,
  ToastMessageOptions,
  ToastManager,
  ExtensionManager,
  CommandManager
} from '@/extension-api/shell'

export type { NodeLocatorId, NodeExecutionId } from '@/extension-api/identifiers'
export {
  isNodeLocatorId,
  isNodeExecutionId,
  parseNodeLocatorId,
  createNodeLocatorId,
  parseNodeExecutionId,
  createNodeExecutionId
} from '@/extension-api/identifiers'
