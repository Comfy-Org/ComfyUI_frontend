import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'

const COMFYUI_ROOT_ROUTE =
  /^\/(prompt|queue|history|interrupt|free|system_stats|features|object_info|embeddings|models|experiment|upload|view_metadata|view|userdata|v2\/userdata|users|settings|i18n|global_subgraphs|node_replacements)(\/|$)/

let installed = false

/** The path and query of a ComfyUI route requested at the site root on this origin, or null. */
export function coreRoutePath(
  input: RequestInfo | URL,
  origin: string = window.location.origin
): string | null {
  const raw =
    typeof input === 'string' ? input : input instanceof URL ? input.href : null
  if (raw === null) return null
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return null
  }
  if (url.origin !== origin || !COMFYUI_ROOT_ROUTE.test(url.pathname)) {
    return null
  }
  return url.pathname + url.search
}

/** A `fetch` that sends ComfyUI routes at the site root through the API and everything else to `sendToPage`. */
export function coreRouteFetch(sendToPage: typeof fetch): typeof fetch {
  return (input, init) => {
    const route = coreRoutePath(input)
    return route === null ? sendToPage(input, init) : api.fetchApi(route, init)
  }
}

/** On Cloud, sends `fetch` calls to ComfyUI routes at the site root through the API. */
export function installCoreRouteFetch(): void {
  if (!isCloud || installed) return
  installed = true
  window.fetch = coreRouteFetch(window.fetch.bind(window))
}
