/**
 * Extension lifecycle — `defineExtension`, `defineNodeExtension`, and
 * the implicit-context lifecycle hooks (`onNodeMounted`, `onNodeRemoved`).
 *
 * Key behaviors:
 * - Hook firing order = registration order with lexicographic tie-break
 *   on extension name.
 * - `setup()` is synchronous. `async setup` throws in dev, emits
 *   console.error in prod.
 * - The object returned by `setup()` is wrapped with `proxyRefs()` so
 *   callers read `entity.extensionState['my-ext'].count` without `.value`.
 *
 * Module-level import only. Extensions do NOT depend on `window.app` being
 * initialized at registration time.
 *
 * @packageDocumentation
 */

// ─── Extension options ───────────────────────────────────────────────────────
//
// The option-type contracts live in ./types so that both this module and the
// runtime service (`@/services/extension-api-service`) can depend on them
// without forming a circular import. This module re-exports them so the
// existing public path `@/extension-api/lifecycle` keeps working.

/**
 * @publicAPI
 * Back-compat re-exports of the extension option contracts. Prefer importing
 * from `@comfyorg/extension-api` (or `@/extension-api`); the
 * `@/extension-api/lifecycle` path is preserved for downstream code that
 * imported these types from the original module.
 */
export type {
  NodeExtensionOptions,
  ExtensionOptions,
  WidgetExtensionOptions
} from './types'

import type {
  NodeExtensionOptions,
  ExtensionOptions,
  WidgetExtensionOptions
} from './types'

// ─── Registration functions ──────────────────────────────────────────────────

/**
 * Register a node extension. The runtime calls `nodeCreated` or
 * `loadedGraphNode` once per node entity matching `nodeTypes`.
 *
 * This is the primary entry point for extensions that interact with nodes and
 * widgets. Import directly from `@comfyorg/extension-api` — no dependency on
 * `window.app` at module evaluation time.
 *
 * Hook firing order across multiple extensions on the same entity follows
 * extension registration order with a lexicographic tie-break on `name`.
 *
 * @publicAPI
 * @example
 * ```ts
 * import { defineNodeExtension } from '@comfyorg/extension-api'
 *
 * export default defineNodeExtension({
 *   name: 'Comfy.PreviewAny',
 *   nodeTypes: ['PreviewAny'],
 *
 *   nodeCreated(node) {
 *     const preview = node.addWidget('STRING', 'preview', '', {
 *       multiline: true, readonly: true, serialize: false
 *     })
 *     node.on('executed', (e) => {
 *       preview.setValue(String(e.output['text'] ?? ''))
 *     })
 *   }
 * })
 * ```
 */
export declare function defineNodeExtension(
  options: NodeExtensionOptions
): NodeExtensionOptions

/**
 * Register an extension for app-wide lifecycle and shell UI contributions.
 *
 * Use `defineNodeExtension` for node/widget interactions. Use this for
 * `init`, `setup`, sidebar tabs, commands, and other app-level concerns.
 *
 * @publicAPI
 * @example
 * ```ts
 * import { defineExtension } from '@comfyorg/extension-api'
 *
 * export default defineExtension({
 *   name: 'my-org.my-extension',
 *   setup() {
 *     console.log('Extension ready')
 *   }
 * })
 * ```
 */
export declare function defineExtension(
  options: ExtensionOptions
): ExtensionOptions

/**
 * Register a custom widget type. Called once at module load time to declare
 * a new widget kind.
 *
 * @stability experimental
 * @publicAPI
 */
export declare function defineWidgetExtension(
  options: WidgetExtensionOptions
): WidgetExtensionOptions

// ─── Implicit-context lifecycle hooks ─────────────────────────────────────────
//
// **Why setup-scope only?** These hooks use Vue-style implicit context:
// 1. The runtime sets a global `_currentScope` slot before calling nodeCreated()
// 2. Hooks read this slot to register callbacks in the correct EffectScope
// 3. The EffectScope auto-disposes all registered callbacks when the node is removed
//
// Benefits of this pattern:
// - Automatic cleanup: no manual unsubscribe needed — scope disposal handles it
// - Consistent with Vue Composition API patterns (onMounted, onUnmounted, etc.)
// - Prevents memory leaks: callbacks are garbage-collected with the node
//
// The synchronous requirement exists because:
// - After an `await`, the call stack has unwound and _currentScope is gone
// - This is the same constraint as Vue's onMounted/onUnmounted hooks
// - In dev mode, calling after await throws; in prod it's a silent no-op

export {
  /**
   * Register a callback to fire when the node entity is fully mounted to the
   * graph (the reactive mount watcher has run, the scope is active, and
   * `setup()` has completed).
   *
   * Must be called synchronously inside `nodeCreated` or `loadedGraphNode`
   * (see module comment for rationale — async context loses the implicit scope).
   *
   * @stability experimental
   * @example
   * ```ts
   * nodeCreated(node) {
   *   onNodeMounted(() => {
   *     // Safe to access DOM widgets, canvas, etc.
   *   })
   * }
   * ```
   */
  onNodeMounted,
  /**
   * Register a callback to fire when the node entity is removed from the graph
   * (NOT on subgraph promotion, which is a DOM-move, not an unmount).
   *
   * Replaces `nodeType.prototype.onRemoved` patching.
   *
   * Must be called synchronously inside `nodeCreated` or `loadedGraphNode`
   * (see module comment for rationale — async context loses the implicit scope).
   *
   * @stability experimental
   * @example
   * ```ts
   * nodeCreated(node) {
   *   onNodeRemoved(() => {
   *     cleanup()
   *   })
   * }
   * ```
   */
  onNodeRemoved
} from '@/services/extension-api-service'
