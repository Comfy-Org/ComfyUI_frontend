import { isCloud, isDesktop } from '@/platform/distribution/types'

export function isLocalAgentGrantHost(): boolean {
  if (isCloud) return false
  if (isDesktop) return true
  const bridge = window.__comfyDesktop2
  if (!bridge) return false
  return !(bridge.isRemote?.() ?? window.__comfyDesktop2Remote ?? false)
}
