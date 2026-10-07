import { WORKSHOP_LOCAL_DEV } from 'astro:env/client'

import { WORKSHOP_OPENJUTSU_PROXY_ID } from '@/config/workshop-env'
import type { ReshootTransport } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import {
  appProxyTransport,
  devProxyTransport
} from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { sampleScenario, sampleTransport } from './sample-transport'

/** `astro dev` only: the page answers itself and no account is needed. */
export const OPENJUTSU_SAMPLE_MODE =
  WORKSHOP_LOCAL_DEV && import.meta.env.PUBLIC_OPENJUTSU_SAMPLE === '1'

/**
 * The app proxy for this Cloud family. In `astro dev` only,
 * `PUBLIC_OPENJUTSU_SAMPLE=1` answers from the page itself and
 * `PUBLIC_OPENJUTSU_PROXY` points at a local dev proxy. Undefined when the
 * family has no proxy for Openjutsu.
 */
export function openjutsuTransport(
  token: () => Promise<string>
): ReshootTransport | undefined {
  if (OPENJUTSU_SAMPLE_MODE)
    return sampleTransport(() => sampleScenario(location.search))
  const devProxy = import.meta.env.PUBLIC_OPENJUTSU_PROXY
  if (WORKSHOP_LOCAL_DEV && devProxy) return devProxyTransport(devProxy)
  return WORKSHOP_OPENJUTSU_PROXY_ID
    ? appProxyTransport(WORKSHOP_OPENJUTSU_PROXY_ID, token)
    : undefined
}
