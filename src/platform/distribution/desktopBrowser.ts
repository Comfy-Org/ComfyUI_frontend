import { isDesktop } from '@/platform/distribution/types'

export function handsPopupsToSystemBrowser(): boolean {
  return isDesktop || window.__comfyDesktop2 !== undefined
}
