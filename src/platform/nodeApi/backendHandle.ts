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
   * Absolute URL for a backend route, honouring however the host is served —
   * a base path, a different port, a proxy.
   */
  url(route: string): string
  /**
   * Absolute URL for a file the host serves, rather than an API route.
   *
   * Distinct from `url()` because that one addresses the API and prepends
   * `/api`, so a static path built through it produced `/api/extensions/…`,
   * which 404s.
   *
   * This is for a path the caller already knows absolutely. It is *not* the
   * way a pack should reach its own neighbouring files: the host serves those
   * from `/extensions/<install-dir>/`, and that directory name is chosen when
   * the pack is installed and can be renamed, so it is not knowable from
   * source. `new URL('x.css', import.meta.url)` resolves against the module's
   * real location and stays correct. One pack ships two spellings of its own
   * directory with an `onerror` fallback between them, which is what guessing
   * costs.
   */
  assetUrl(route: string): string
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
   * Calls a backend route with the host's own credentials attached.
   *
   * `url()` only builds a string, so a pack calling `fetch()` on it sends an
   * unauthenticated request — fine on a local install, a 401 on a hosted one.
   * Packs ship their own Python routes and were reaching for `api.fetchApi`
   * precisely to inherit the session; this is that, and nothing more.
   *
   * The route is API-relative and must start with `/`, as `url()` requires.
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
