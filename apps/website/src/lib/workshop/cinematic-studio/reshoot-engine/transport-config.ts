import { WORKSHOP_LOCAL_DEV } from 'astro:env/client'

import type { ReshootTransport } from './transport'
import { appProxyTransport, devProxyTransport } from './transport'

/**
 * The app proxy for this Cloud family, named by `PUBLIC_WORKSHOP_RESHOOT_PROXY_ID`
 * (a public id, not a secret). In `astro dev` only, `PUBLIC_CROSSVIEW_PROXY`
 * points at the local dev proxy instead. Undefined when neither is configured.
 */
export function reshootTransport(
  token: () => Promise<string>
): ReshootTransport | undefined {
  const devProxy = import.meta.env.PUBLIC_CROSSVIEW_PROXY
  if (WORKSHOP_LOCAL_DEV && devProxy) return devProxyTransport(devProxy)
  const proxyId = import.meta.env.PUBLIC_WORKSHOP_RESHOOT_PROXY_ID
  return proxyId ? appProxyTransport(proxyId, token) : undefined
}
