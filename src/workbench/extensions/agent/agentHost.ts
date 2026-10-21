import { isCloud, isDesktop } from '@/platform/distribution/types'

export function isLocalDesktopHost(): boolean {
  return (
    !isCloud && (isDesktop || window.__comfyDesktop2?.isRemote?.() === false)
  )
}
