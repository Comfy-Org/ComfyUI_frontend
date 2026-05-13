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
 * `window.app` at module evaluation time (D6 Part 1).
 *
 * Hook firing order across multiple extensions on the same entity follows
 * extension registration order with a lexicographic tie-break on `name` (D10b).
 *
 * @stability stable
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
 * @stability stable
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

// ─── Implicit-context lifecycle hooks (D10a) ─────────────────────────────────
//
// These functions read the _currentScope global slot set by the runtime
// immediately before invoking nodeCreated()/loadedGraphNode(). They must be
// called synchronously during setup — calling them after an `await` is a no-op
// in production and throws in development.
//
// The ctx.onNodeMounted(fn) form from D6 Part 1 examples is a thin alias on
// NodeHandle that calls these same functions under the hood.

export {
  /**
   * Register a callback to fire when the node entity is fully mounted to the
   * graph (the reactive mount watcher has run, the scope is active, and
   * `setup()` has completed).
   *
   * Must be called synchronously inside `nodeCreated` or `loadedGraphNode`.
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
   * Replaces `nodeType.prototype.onRemoved` patching (S2.N4 — 7+ repos,
   * 4.89 blast radius).
   *
   * Must be called synchronously inside `nodeCreated` or `loadedGraphNode`.
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
