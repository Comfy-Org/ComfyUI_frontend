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

/** `astro dev` only: a local proxy in front of Openjutsu's own deployment. */
const DEV_PROXY = WORKSHOP_LOCAL_DEV
  ? import.meta.env.PUBLIC_OPENJUTSU_PROXY
  : undefined

/**
 * `astro dev` only: runs that need no account. The page answers itself, or a
 * local proxy holds the key and nothing is metered.
 */
export const OPENJUTSU_NO_ACCOUNT = OPENJUTSU_SAMPLE_MODE || !!DEV_PROXY

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
  if (DEV_PROXY) return devProxyTransport(DEV_PROXY)
  return WORKSHOP_OPENJUTSU_PROXY_ID
    ? appProxyTransport(WORKSHOP_OPENJUTSU_PROXY_ID, token)
    : undefined
}
