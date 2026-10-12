import { WORKSHOP_LOCAL_DEV } from 'astro:env/client'

import { WORKSHOP_RESHOOT_PROXY_ID } from '@/config/workshop-env'
import type { ReshootTransport } from './transport'
import { appProxyTransport, devProxyTransport } from './transport'

/**
 * The app proxy for this Cloud family. In `astro dev` only,
 * `PUBLIC_CROSSVIEW_PROXY` points at the local dev proxy instead. Undefined
 * when the family has no proxy for Re-shoot.
 */
export function reshootTransport(
  token: () => Promise<string>
): ReshootTransport | undefined {
  const devProxy = import.meta.env.PUBLIC_CROSSVIEW_PROXY
  if (WORKSHOP_LOCAL_DEV && devProxy) return devProxyTransport(devProxy)
  return WORKSHOP_RESHOOT_PROXY_ID
    ? appProxyTransport(WORKSHOP_RESHOOT_PROXY_ID, token)
    : undefined
}
