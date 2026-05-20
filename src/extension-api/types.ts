/**
 * Extension option interfaces — the type contracts for `defineNode`,
 * `defineExtension`, and `defineWidget`.
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
import type { WidgetMountFn } from './widget'

/**
 * Options for `defineNode`. Describes an extension that reacts to
 * node lifecycle events.
 *
 * @example
 * ```ts
 * import { defineNode } from '@comfyorg/extension-api'
 *
 * export default defineNode({
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
   *
   * @deprecated Per D-bootstrap-hooks (W6.P6.C, ACCEPTED 2026-05-14): move the
   * `init` body into `setup()`. The body of `setup()` runs at the same point
   * `init` used to run (early lifecycle); use `onMounted(() => ...)` inside
   * `setup()` for what `init` did via late-lifecycle assumptions. A codemod
   * ships in `@comfyorg/extension-api` to perform the rewrite mechanically.
   * The v1 hook is retained for back-compat during the deprecation window.
   */
  init?(): void | Promise<void>

  /**
   * Runs once after the app and all core extensions are initialized. Equivalent
   * to the v1 `ComfyExtension.setup`. Safe to call shell UI registration APIs
   * (`ExtensionManager`, `CommandManager`) here.
   *
   * @deprecated Per D-bootstrap-hooks (W6.P6.C, ACCEPTED 2026-05-14): the
   * `setup` property name is retained, but the v1 semantic "fires after all
   * core extensions ready" now lives in `onMounted(() => ...)` *inside* the
   * `setup()` body. The `setup()` body itself now runs at the earlier
   * registration-equivalent point (where v1 `init` used to run). Use
   * `onBeforeMount` / `onMounted` / `onUnmounted` / `onActivated` /
   * `onDeactivated` for fine-grained lifecycle hooks.
   *
   * Migration:
   * ```ts
   * // v1
   * setup() { api.addEventListener('execution_start', fn) }
   * // v2
   * setup() { onMounted(() => execution.on('start', fn)) }
   * ```
   *
   * A codemod ships in `@comfyorg/extension-api`.
   */
  setup?(): void | Promise<void>
}

/**
 * Options for `defineWidget`. Registers a custom widget type that renders
 * through the mount-lifecycle seam (Axiom A12 / D-widget-converge).
 *
 * Once registered, the widget type can be referenced from Python
 * `INPUT_TYPES` schema declarations. The runtime allocates a per-widget
 * host `<div>` and invokes the registered `mount(host, ctx)` hook against
 * it. The widget's mount body captures the host (and any DOM it
 * constructs) via closure — there is no `widget.element` accessor on the
 * handle.
 *
 * Runtime widget addition (`node.addWidget(...)`) is forbidden per
 * AXIOMS.md A15 / `decisions/D-ban-runtime-addwidget.md` — widgets are
 * schema-declared, never created at runtime by extensions.
 *
 * `mount` is optional: omit it for value-only widgets (numeric, combo, etc.)
 * that render through the native widget renderer with no custom DOM.
 *
 * @stability experimental
 * @example
 * ```ts
 * import { defineWidget } from '@comfyorg/extension-api'
 *
 * export default defineWidget({
 *   name: 'my-org.color-picker',
 *   type: 'COLOR_PICKER',
 *
 *   mount(host, ctx) {
 *     const input = document.createElement('input')
 *     input.type = 'color'
 *     input.value = String(ctx.widget.getValue() ?? '#000000')
 *     input.addEventListener('input', () => ctx.widget.setValue(input.value))
 *     host.appendChild(input)
 *     // Optional cleanup — fires once on widget destruction.
 *     return () => input.remove()
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
   * Mount lifecycle hook — the **sole** DOM seam per Axiom A12. Called once
   * per widget instance when the widget is first attached to its node host
   * in the DOM. May return a `WidgetCleanup` function that fires on widget
   * destruction (host remount does NOT fire cleanup; see
   * `WidgetMountContext.onBeforeRemount` / `onAfterRemount`).
   *
   * Omit entirely for value-only widgets that need no custom DOM.
   *
   * @stability experimental
   */
  mount?: WidgetMountFn
}
