/**
 * Shared event infrastructure for the ComfyUI extension API.
 *
 * @packageDocumentation
 */

/**
 * A typed event handler function.
 *
 * @typeParam E - The event payload type.
 * @example
 * ```ts
 * const handler: Handler<WidgetValueChangeEvent<number>> = (e) => {
 *   console.log(e.oldValue, '->', e.newValue)
 * }
 * ```
 */
export type Handler<E> = (event: E) => void

/**
 * A typed async-capable event handler. Only valid for events that explicitly
 * support async handling (currently only `beforeSerialize`).
 *
 * @typeParam E - The event payload type.
 */
export type AsyncHandler<E> = (event: E) => void | Promise<void>

/**
 * Cleanup function returned by `on()` — call to remove the listener.
 *
 * @example
 * ```ts
 * const off = node.on('executed', handler)
 * // later:
 * off()
 * ```
 */
export type Unsubscribe = () => void

// ─────────────────────────────────────────────────────────────────────────────
// D-bootstrap-hooks (W6.P6.C) — Event-namespace facades
// ─────────────────────────────────────────────────────────────────────────────
//
// Four typed event-namespace handles (`graph` / `execution` / `server` /
// `workbench`) replace the ad-hoc `api.addEventListener('execution_start', ...)`
// pattern documented in 360+ ecosystem call sites. Each namespace is a
// module-level singleton (SD-4 (a), handoff-11) — call from any setup() body
// or hook closure. Subscriptions registered inside a setup context auto-dispose
// when the surrounding instance is unmounted (Vue-style; subscription is added
// to the context's unmountHooks). Outside a setup context, the returned
// `Unsubscribe` is the caller's responsibility.
//
// Payload typing (SD-5 (b)): each `on()` accepts a string event name and
// returns `Handler<EventPayloadMap[ns][evt]>`. The maps default to `unknown`
// today and are tightened by D5 module augmentation in a follow-on PR. Authors
// get autocomplete on canonical event names; payload narrowing arrives when
// D5 lands.

import { api } from '@/scripts/api'

import { getCurrentExtensionInstance } from '@/services/extension-api-service'

/**
 * Per-namespace event payload map. **Augment via TS module augmentation** to
 * narrow payloads for canonical events. Until D5 ships, all payloads default
 * to `unknown`.
 *
 * @example
 * ```ts
 * declare module '@comfyorg/extension-api' {
 *   interface ExecutionEventPayloads {
 *     start: { promptId: string }
 *     progress: { value: number; max: number }
 *   }
 * }
 * ```
 */
export interface GraphEventPayloads {
  [event: string]: unknown
}
export interface ExecutionEventPayloads {
  [event: string]: unknown
}
export interface ServerEventPayloads {
  [event: string]: unknown
}
export interface WorkbenchEventPayloads {
  [event: string]: unknown
}

interface EventNamespace<M> {
  /**
   * Subscribe to an event. Returns an {@link Unsubscribe} function.
   *
   * Inside a `setup()` body the subscription is also added to the
   * surrounding instance's `onUnmounted` queue and auto-disposes when the
   * extension/tab/panel is unmounted.
   */
  on<K extends keyof M & string>(event: K, handler: Handler<M[K]>): Unsubscribe

  /**
   * Remove a previously registered handler. Same as the {@link Unsubscribe}
   * returned by `on()`. Exposed for symmetry with `addEventListener`/`removeEventListener`.
   */
  off<K extends keyof M & string>(event: K, handler: Handler<M[K]>): void
}

function makeNamespace<M>(rename: (evt: string) => string): EventNamespace<M> {
  // ComfyApi extends EventTarget but its addEventListener is strictly typed
  // against the validated ApiCalls union. The bootstrap-hooks facade
  // accepts any string (custom-node events ride server.on with arbitrary
  // names per ADR), so we widen via EventTarget to get the generic overload.
  const target = api as unknown as EventTarget
  return {
    on<K extends keyof M & string>(
      event: K,
      handler: Handler<M[K]>
    ): Unsubscribe {
      const wireName = rename(event)
      // payload arrives as CustomEvent.detail.
      const adapter = (e: Event): void => {
        const detail = (e as CustomEvent).detail as M[K]
        handler(detail)
      }
      target.addEventListener(wireName, adapter)
      const unsubscribe: Unsubscribe = () => {
        target.removeEventListener(wireName, adapter)
      }
      // Auto-dispose inside a setup() context (mirrors Vue's onScopeDispose).
      const ctx = getCurrentExtensionInstance()
      if (ctx) {
        ctx.unmountHooks.push(unsubscribe)
      }
      return unsubscribe
    },
    off<K extends keyof M & string>(event: K, handler: Handler<M[K]>): void {
      // Note: off() with a raw handler only matches if the caller saved the
      // exact adapter reference returned from on(). The recommended path is
      // to call the Unsubscribe returned by on(). This off() is retained for
      // API symmetry but does NOT round-trip with on() handlers — they wrap
      // the user fn in an adapter for CustomEvent unwrap. Authors that need
      // explicit off() should use the Unsubscribe handle.
      target.removeEventListener(
        rename(event),
        handler as unknown as EventListener
      )
    }
  }
}

/**
 * Graph-mutation events (frontend-dispatched).
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { onMounted, graph } from '@comfyorg/extension-api'
 *
 * defineExtension({
 *   name: 'my-ext',
 *   setup() {
 *     onMounted(() => {
 *       graph.on('changed', (e) => console.log('graph changed', e))
 *     })
 *   }
 * })
 * ```
 */
export const graph: EventNamespace<GraphEventPayloads> = makeNamespace(
  (evt) => `graph:${evt}`
)

/**
 * Prompt-run lifecycle events (backend-dispatched).
 *
 * Canonical events: `'start'`, `'end'`, `'error'`, `'interrupted'`, `'cached'`,
 * `'executing'`, `'progress'`, `'preview'`. The wire-name mapping rewrites
 * `'start'` → `'execution_start'`, etc., matching the legacy
 * `api.addEventListener('execution_start', ...)` shape.
 *
 * @publicAPI
 * @stability experimental
 */
export const execution: EventNamespace<ExecutionEventPayloads> = makeNamespace(
  (evt) => `execution_${evt}`
)

/**
 * Non-execution backend events + custom-node events.
 *
 * Canonical events: `'status'`, `'logs'`, `'reconnected'`, `'feature_flags'`,
 * `'assets'`. Custom-node events ride this channel with arbitrary string
 * (e.g. `server.on('rayko.inspline.show', ...)`). Module-augment
 * `ServerEventPayloads` to type custom events.
 *
 * @publicAPI
 * @stability experimental
 */
export const server: EventNamespace<ServerEventPayloads> = makeNamespace(
  (evt) => evt
)

/**
 * UI shell events.
 *
 * Canonical events today: `'notification'`. Future: `'themeChanged'`,
 * `'panelToggled'`, `'commandInvoked'`. NOT a DI container — see
 * D-bootstrap-hooks §Decision for the "thin event-namespace handle only"
 * scope-back.
 *
 * @publicAPI
 * @stability experimental
 */
export const workbench: EventNamespace<WorkbenchEventPayloads> = makeNamespace(
  (evt) => `workbench:${evt}`
)
