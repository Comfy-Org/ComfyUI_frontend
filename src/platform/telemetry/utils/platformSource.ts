import { isCloud, isDesktop } from '@/platform/distribution/types'

import type { PlatformSource } from '../types'
import {
  readAttributionFromUrl,
  readStoredAttribution
} from './checkoutAttributionStorage'

export function getCheckoutPlatformSource(): PlatformSource | undefined {
  if (typeof window === 'undefined') return undefined

  if (isCloud) {
    const fromUrl = readAttributionFromUrl(window.location.search)
    const source = fromUrl.utm_source ?? readStoredAttribution().utm_source

    return source === 'comfy.desktop' ? 'desktop_cloud' : 'cloud'
  }

  return isDesktop ? 'desktop_local' : undefined
}
