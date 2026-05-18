/**
 * Extension lifecycle — `defineExtension`, `defineNode`, and
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
 * import { defineNode } from '@comfyorg/extension-api'
 *
 * export default defineNode({
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
export declare function defineNode(
  options: NodeExtensionOptions
): NodeExtensionOptions

/**
 * Register an extension for app-wide lifecycle and shell UI contributions.
 *
 * Use `defineNode` for node/widget interactions. Use this for
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
 * @example
 * ```ts
 * import { defineWidgetExtension } from '@comfyorg/extension-api'
 *
 * export default defineWidgetExtension({
 *   name: 'my-org.color-picker',
 *   type: 'COLOR_PICKER'
 * })
 * ```
 */
export declare function defineWidget(
  options: WidgetExtensionOptions
): WidgetExtensionOptions

/**
 * ## Implicit-Context Lifecycle Hooks
 *
 * `onNodeMounted` and `onNodeRemoved` use Vue-style implicit context to
 * associate callbacks with the current node's cleanup scope. This pattern
 * provides automatic cleanup without manual unsubscribe bookkeeping.
 *
 * ### How it works
 *
 * 1. The runtime sets a global scope slot before calling `nodeCreated()`
 * 2. Lifecycle hooks read this slot to register callbacks in the node's scope
 * 3. When the node is removed, the scope auto-disposes all registered callbacks
 *
 * ### Why synchronous-only?
 *
 * These hooks **must** be called synchronously inside `nodeCreated` or
 * `loadedGraphNode`. After an `await`, the call stack has unwound and the
 * implicit scope context is gone — the same constraint as Vue's `onMounted`.
 *
 * ```ts
 * // ✅ CORRECT — synchronous call
 * nodeCreated(node) {
 *   onNodeMounted(() => console.log('mounted'))
 * }
 *
 * // ❌ WRONG — after await, scope context is lost
 * async nodeCreated(node) {
 *   await fetch('/api')
 *   onNodeMounted(() => {})  // Throws in dev, silent no-op in prod
 * }
 * ```
 *
 * ### Benefits
 *
 * - **Automatic cleanup**: no manual `unsubscribe()` calls needed
 * - **Memory-safe**: callbacks are garbage-collected with the node
 * - **Familiar pattern**: mirrors Vue Composition API (`onMounted`, `onUnmounted`)
 *
 * @see {@link onNodeMounted} — fires after node is fully mounted
 * @see {@link onNodeRemoved} — fires before node cleanup (not on subgraph moves)
 */

/**
 * ## Context-Scoped Bootstrap Hooks (D-bootstrap-hooks, W6.P6.C)
 *
 * In addition to the node-level `onNodeMounted` / `onNodeRemoved` hooks above,
 * the v2 API exposes Vue-idiomatic context-scoped hooks for
 * `defineExtension.setup` / `defineSidebarTab.setup` / `defineBottomPanelTab.setup`
 * bodies:
 *
 * - `onBeforeMount`  — before the surrounding instance is mounted
 * - `onMounted`      — after the surrounding instance is mounted
 * - `onUnmounted`    — when the surrounding instance is unmounted
 * - `onActivated`    — when a sidebar tab / bottom panel is shown (tab/panel only)
 * - `onDeactivated`  — when a sidebar tab / bottom panel is hidden (tab/panel only)
 *
 * Like Vue's `onMounted`, these must be called synchronously inside the
 * surrounding `setup()` body. Calling them after an `await` (or outside any
 * setup context) throws in development and silently no-ops in production.
 *
 * See {@link onMounted} for full usage examples.
 */
export {
  onBeforeMount,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated
} from '@/services/extension-api-service'

export {
  /**
   * Register a callback to fire when the node is fully mounted to the graph.
   *
   * "Mounted" means: the reactive mount watcher has run, the node's scope is
   * active, and any `setup()` return value has been captured. Safe to access
   * DOM widgets, canvas elements, and other post-mount resources.
   *
   * **Must be called synchronously** inside `nodeCreated` or `loadedGraphNode`.
   * Calling after an `await` throws in development and silently no-ops in
   * production (see module docs for rationale).
   *
   * @stability experimental
   * @example
   * ```ts
   * import { defineNode, onNodeMounted } from '@comfyorg/extension-api'
   *
   * export default defineNode({
   *   name: 'my-ext',
   *   nodeTypes: ['MyNode'],
   *
   *   nodeCreated(node) {
   *     // Register mount callback synchronously
   *     onNodeMounted(() => {
   *       console.log('Node fully mounted, DOM ready')
   *       // Safe to query DOM widgets, measure sizes, etc.
   *     })
   *
   *     // Can register multiple callbacks
   *     onNodeMounted(() => {
   *       node.setSize([300, 200])  // Resize after mount
   *     })
   *   }
   * })
   * ```
   */
  onNodeMounted,
  /**
   * Register a callback to fire when the node is removed from the graph.
   *
   * Use for cleanup: close connections, abort fetches, release resources.
   * Does NOT fire on subgraph promotion (which is a DOM move, not removal) —
   * the node's entity ID is preserved across promotion.
   *
   * Replaces the v1 `nodeType.prototype.onRemoved` patching pattern.
   *
   * **Must be called synchronously** inside `nodeCreated` or `loadedGraphNode`.
   * Calling after an `await` throws in development and silently no-ops in
   * production (see module docs for rationale).
   *
   * @stability experimental
   * @example
   * ```ts
   * import { defineNode, onNodeRemoved } from '@comfyorg/extension-api'
   *
   * export default defineNode({
   *   name: 'my-ext',
   *   nodeTypes: ['MyNode'],
   *
   *   nodeCreated(node) {
   *     const controller = new AbortController()
   *
   *     // Start a long-running fetch
   *     fetch('/api/stream', { signal: controller.signal })
   *       .then(res => processStream(res))
   *
   *     // Clean up when node is deleted
   *     onNodeRemoved(() => {
   *       controller.abort()
   *       console.log('Cleanup complete')
   *     })
   *   }
   * })
   * ```
   */
  onNodeRemoved
} from '@/services/extension-api-service'
