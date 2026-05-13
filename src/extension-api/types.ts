/**
 * Extension option interfaces — the type contracts for `defineNodeExtension`,
 * `defineExtension`, and `defineWidgetExtension`.
 *
 * Lives in its own module so the runtime service (`@/services/extension-api-service`)
 * and the public lifecycle barrel (`@/extension-api/lifecycle`) can both depend on
 * these types without forming a circular import (the service implements the
 * `defineXxx` functions and the `onNodeMounted` / `onNodeRemoved` hooks that the
 * lifecycle module re-exports).
 *
 * @packageDocumentation
 */

import type { NodeHandle } from './node'
import type { WidgetHandle } from './widget'

/**
 * Options for `defineNodeExtension`. Describes an extension that reacts to
 * node lifecycle events.
 *
 * @example
 * ```ts
 * import { defineNodeExtension } from '@comfyorg/extension-api'
 *
 * export default defineNodeExtension({
 *   name: 'my-org.my-extension',
 *   nodeTypes: ['KSampler'],
 *
 *   nodeCreated(node) {
 *     node.on('executed', (e) => console.log('done', e.output))
 *   }
 * })
 * ```
 */
export interface NodeExtensionOptions {
  /**
   * Globally unique extension name. Used for scope registry keying, hook
   * ordering (lexicographic tie-break), and debug messages.
   *
   * Convention: `'org.extension-name'` or `'Comfy.ExtensionName'`.
   */
  name: string

  /**
   * Filter to specific `comfyClass` names. When omitted, the extension
   * receives `nodeCreated` / `loadedGraphNode` for every node type.
   *
   * Replaces the v1 `beforeRegisterNodeDef` filtering pattern.
   *
   * @example
   * ```ts
   * nodeTypes: ['KSampler', 'KSamplerAdvanced']
   * ```
   */
  nodeTypes?: string[]

  /**
   * Called once per node instance when the node is first created (typed in,
   * pasted from clipboard, duplicated, or loaded without an existing workflow).
   *
   * - Runs inside a Vue `EffectScope`. All `watch` / `computed` / `onNodeMounted`
   *   calls made here are captured and disposed automatically on node removal.
   * - Must be synchronous. Kick off async work inside the body; use
   *   `loading: ref(true)` for async-dependent state.
   * - Called only once per entity ID lifetime. Copy/paste creates a fresh entity
   *   and fires `nodeCreated` again on the new entity (reset-to-fresh).
   */
  nodeCreated?(node: NodeHandle): void

  /**
   * Called once per node instance when the node is restored from a saved
   * workflow. Widget values are already populated when this fires.
   *
   * Same rules as `nodeCreated`. Exactly one of `nodeCreated` or
   * `loadedGraphNode` fires per node entity, never both.
   *
   * Replaces the v1 `loadedGraphNode` hook and `nodeType.prototype.onConfigure`
   * patching.
   */
  loadedGraphNode?(node: NodeHandle): void
}

/**
 * Options for the global `defineExtension` entry point. Covers extension-wide
 * lifecycle and shell UI contributions.
 *
 * @example
 * ```ts
 * import { defineExtension } from '@comfyorg/extension-api'
 *
 * export default defineExtension({
 *   name: 'my-org.my-extension',
 *   async setup() {
 *     // App is ready; register commands, sidebar tabs, etc.
 *   }
 * })
 * ```
 */
export interface ExtensionOptions {
  /**
   * Globally unique extension name. Matches the format of
   * `NodeExtensionOptions.name`.
   */
  name: string

  /**
   * Runs once during app initialization (after the app is mounted but before
   * the first workflow is loaded). Equivalent to the v1 `ComfyExtension.init`.
   */
  init?(): void | Promise<void>

  /**
   * Runs once after the app and all core extensions are initialized. Equivalent
   * to the v1 `ComfyExtension.setup`. Safe to call shell UI registration APIs
   * (`ExtensionManager`, `CommandManager`) here.
   */
  setup?(): void | Promise<void>
}

/**
 * Options for `defineWidgetExtension`. Describes an extension that provides a
 * custom widget type with its own DOM rendering.
 *
 * @stability experimental
 * @example
 * ```ts
 * import { defineWidgetExtension } from '@comfyorg/extension-api'
 *
 * export default defineWidgetExtension({
 *   name: 'my-org.color-picker',
 *   type: 'COLOR_PICKER',
 *
 *   widgetCreated(widget, node) {
 *     return {
 *       render(container) { /* mount color picker DOM *\/ },
 *       destroy()        { /* cleanup *\/ }
 *     }
 *   }
 * })
 * ```
 */
export interface WidgetExtensionOptions {
  /** Globally unique extension name. */
  name: string
  /** Widget type string this extension provides (e.g. `'COLOR_PICKER'`). */
  type: string

  /**
   * Called once per widget instance. Return a `{ render, destroy }` pair for
   * custom DOM rendering, or `void` for non-visual widgets.
   *
   * @stability experimental
   */
  widgetCreated?(
    widget: WidgetHandle,
    parentNode: NodeHandle | null
  ): { render(container: HTMLElement): void; destroy?(): void } | void
}
