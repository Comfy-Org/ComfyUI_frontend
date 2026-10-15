/**
 * Talking to the backend: building a URL, and hearing a message.
 *
 * The last thing keeping the legacy `api` object alive in otherwise converted
 * packs. Three kjnodes files need it — one to build a `/view` URL for audio,
 * two to receive a message the pack's own Python side emits.
 *
 * `on` deliberately accepts any event name. `b.onPreview` covers the built-in
 * preview channel and answers "is this frame for my node?", but a pack that
 * ships its own backend node can emit anything, and its payload is its own —
 * a structured record, not a frame. Constraining the name to events core knows
 * about would exclude exactly the packs that need this most.
 */
import { api } from '@/scripts/api'

import { ComfyApiError } from './errors'
import type { Unsubscribe } from './widgetHandle'

export interface BackendHandle {
  /**
   * @deprecated Trusted host adapter only; unavailable to Secure Nodes packs.
   * Use `fetch()` with a pack-relative path, or a named `comfy.*` capability.
   */
  url(route: string): string
  /**
   * @deprecated Trusted host adapter only; unavailable to Secure Nodes packs.
   * Use module-relative URLs for bundled files and named APIs for host assets.
   */
  assetUrl(route: string): string
  /**
   * Calls this pack's declared endpoint using the same relative-path contract
   * as `fetch()`. It cannot access core routes or another pack's endpoints.
   */
  ownFetch(route: string, init?: RequestInit): Promise<Response>
  /**
   * Identifies this frontend connection to a pack's own backend route.
   * Undefined until the backend establishes the connection; do not persist it.
   */
  sessionId(): string | undefined
  /**
   * Subscribes to a backend message. The name is whatever the backend emits;
   * `detail` is its payload, unparsed.
   */
  on(event: string, listener: (detail: unknown) => void): Unsubscribe
  /**
   * In a Secure Nodes worker, calls only this pack's declared endpoints.
   * Use a relative path such as `presets`, with no leading slash, dot segments,
   * percent-encoded path or scheme. The host re-encodes query values, assigns
   * the namespace from trusted pack identity and owns authentication.
   * Shared/core operations use named async `comfy.*` methods with validation
   * and capability checks. The trusted in-process adapter retains API-root
   * paths for host code; it does not provide sandbox authorization.
   */
  fetch(route: string, init?: RequestInit): Promise<Response>
}

export function createBackendApi(): BackendHandle {
  const handle: BackendHandle = {
    url(route: string) {
      if (!route.startsWith('/')) {
        throw new ComfyApiError(
          `Route '${route}' must start with '/', e.g. '/view?filename=x'.`
        )
      }
      return api.apiURL(route)
    },

    assetUrl(route: string) {
      if (!route.startsWith('/')) {
        throw new ComfyApiError(
          `Route '${route}' must start with '/', e.g. '/extensions/my-pack/icon.png'.`
        )
      }
      return api.fileURL(route)
    },

    ownFetch() {
      throw new ComfyApiError(
        'Pack-owned routes are available only inside a Secure Nodes pack sandbox.'
      )
    },

    sessionId() {
      return api.clientId
    },

    fetch(route: string, init?: RequestInit) {
      if (!route.startsWith('/')) {
        throw new ComfyApiError(
          `Route '${route}' must start with '/', e.g. '/my-pack/items'.`
        )
      }
      // Delegates rather than rebuilding the header set: auth is the host's
      // business and it changes (cloud added a Firebase JWT and a 401 retry).
      return api.fetchApi(route, init)
    },

    on(event: string, listener: (detail: unknown) => void) {
      const wrapped = (e: Event) => listener((e as CustomEvent).detail)
      api.addEventListener(event as never, wrapped)
      return () => api.removeEventListener(event as never, wrapped)
    }
  }
  return Object.freeze(handle)
}
