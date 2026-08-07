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
   * `/api`. A pack's own assets are static files under
   * `/extensions/<pack>/…`, so building them through `url()` produced
   * `/api/extensions/…`, which 404s. Every pack that ships an image, a font,
   * an HTML page or a model needs this.
   */
  assetUrl(route: string): string
  /**
   * Subscribes to a backend message. The name is whatever the backend emits;
   * `detail` is its payload, unparsed.
   */
  on(event: string, listener: (detail: unknown) => void): Unsubscribe
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

    on(event: string, listener: (detail: unknown) => void) {
      const wrapped = (e: Event) => listener((e as CustomEvent).detail)
      api.addEventListener(event as never, wrapped as never)
      return () => api.removeEventListener(event as never, wrapped as never)
    }
  }
  return Object.freeze(handle)
}
