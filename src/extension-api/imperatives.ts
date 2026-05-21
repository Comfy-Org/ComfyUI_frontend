/**
 * Inline imperative shell APIs — `toast` + `notify`
 *.
 *
 * Per the ACCEPTED PICK (option (ii) "separate entries" with an
 * inline-imperative carve-out), `toast` and `notify` are NOT exposed as
 * `defineToast` / `defineNotify` `defineX` entries — the R1+R2+R3 evidence
 * showed both are 100% imperative in the ecosystem today (166 toast hits /
 * 16 repos, zero use as a registration target). Forcing a `defineX` wrapper
 * would invent a registration concept that doesn't exist in user mental
 * models.
 *
 * Authors call these directly from any setup body or hook closure:
 *
 * ```ts
 * import {
 *   defineExtension,
 *   onMounted,
 *   toast
 * } from '@comfyorg/extension-api'
 *
 * defineExtension({
 *   name: 'my-ext',
 *   setup() {
 *     onMounted(() => {
 *       toast.show({ severity: 'info', summary: 'Ready' })
 *     })
 *   }
 * })
 * ```
 *
 * Both APIs are fire-and-forget; there is no handle to dispose. The toast
 * component manages its own lifetime (auto-dismiss via the `life` option).
 *
 * @packageDocumentation
 */

import type { ToastMessageOptions } from '@/types/extensionTypes'

/**
 * Optional shape for {@link notify} — a thinner convenience API over
 * {@link toast}. `kind` maps onto PrimeVue toast severities; `message` maps
 * to `summary`; `detail` is optional supplementary text.
 *
 * @deprecated Use {@link ToastMessageOptions} via `toast.show(...)`. See
 * D-notify-toast-consolidation.
 * @publicAPI
 * @stability experimental
 */
export interface NotifyOptions {
  /** Severity kind. Default `'info'`. */
  kind?: 'success' | 'info' | 'warn' | 'error'
  /** Primary message text. */
  message: string
  /** Optional supplementary detail line. */
  detail?: string
  /** Auto-dismiss delay in ms. Defaults to PrimeVue's `life`. */
  life?: number
}

/**
 * Toast surface — call `toast.show(...)` from any setup body or hook
 * closure.
 *
 * Fire-and-forget. The toast is rendered by the global Toast component
 * mounted at app root; the call is a no-op if the app is not yet mounted
 * (the message is silently dropped rather than queued).
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * toast.show({ severity: 'info', summary: 'Saved', life: 2000 })
 * ```
 */
export const toast: {
  /** Show a toast. Severity defaults to `'info'`. */
  show(opts: ToastMessageOptions): void
  /** Remove a previously-shown toast (matches by reference). */
  remove(opts: ToastMessageOptions): void
  /** Clear every toast currently visible. */
  removeAll(): void
} = {
  show(opts: ToastMessageOptions): void {
    void _withToastStore((store) => store.add(opts))
  },
  remove(opts: ToastMessageOptions): void {
    void _withToastStore((store) => store.remove(opts))
  },
  removeAll(): void {
    void _withToastStore((store) => store.removeAll())
  }
}

/**
 * Convenience notification API — a thinner wrapper over {@link toast} that
 * accepts a `{ kind, message, detail }` shape closer to OS notification
 * vocabulary. Use whichever shape you prefer; they share the same
 * underlying transport.
 *
 * Fire-and-forget.
 *
 * @deprecated Use {@link toast.show} — `notify` is a 1:1 wrapper sharing the
 * same transport. See D-notify-toast-consolidation.
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * // `notify` is deprecated — prefer `toast.show` directly. See
 * // D-notify-toast-consolidation.
 * import { toast } from '@comfyorg/extension-api'
 *
 * toast.show({
 *   severity: 'error',
 *   summary: 'Workflow failed',
 *   detail: err.message
 * })
 * ```
 */
export function notify(opts: NotifyOptions): void {
  const severity = opts.kind ?? 'info'
  toast.show({
    severity,
    summary: opts.message,
    detail: opts.detail,
    life: opts.life
  })
}

/**
 * Resolve the toast store on demand. Lazy-imported so this module is safe
 * to evaluate at module-init time (before Pinia is ready). Errors are
 * surfaced loudly in dev and swallowed in prod — toasts are non-critical.
 *
 * @internal
 */
async function _withToastStore(
  fn: (store: {
    add(opts: ToastMessageOptions): void
    remove(opts: ToastMessageOptions): void
    removeAll(): void
  }) => void
): Promise<void> {
  try {
    const { useToastStore } =
      await import('@/platform/updates/common/toastStore')
    const store = useToastStore()
    fn(store)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[extension-api] toast call failed:', err)
    }
  }
}
