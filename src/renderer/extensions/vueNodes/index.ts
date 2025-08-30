/**
 * Vue Nodes Renderer Extension
 *
 * This extension provides Vue-based node rendering capabilities for ComfyUI.
 * Domain-driven architecture organizing concerns by function rather than technical layers.
 *
 * Architecture:
 * - components/ - Vue node UI components (LGraphNode, NodeHeader, etc.)
 * - widgets/ - Widget rendering system (components, composables, registry)
 * - lod/ - Level of Detail system for performance
 * - layout/ - Node positioning and layout logic
 * - interaction/ - User interaction handling (planned)
 */

// Main node components
export { default as LGraphNode } from './components/LGraphNode.vue'
export { default as NodeHeader } from './components/NodeHeader.vue'
export { default as NodeContent } from './components/NodeContent.vue'
export { default as NodeSlots } from './components/NodeSlots.vue'
export { default as NodeWidgets } from './components/NodeWidgets.vue'
export { default as InputSlot } from './components/InputSlot.vue'
export { default as OutputSlot } from './components/OutputSlot.vue'

// Widget system exports
export * from './widgets/registry/widgetRegistry'
export * from './widgets/composables/useWidgetRenderer'
export * from './widgets/composables/useWidgetValue'
export * from './widgets/useNodeWidgets'

// Level of Detail system
export * from './lod/useLOD'

// Layout system exports
export * from './layout/useNodeLayout'
