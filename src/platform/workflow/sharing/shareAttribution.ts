import type { ShareAttribution } from '@/platform/workflow/sharing/types/shareTypes'

let activeShareAttribution: ShareAttribution | undefined

export function getActiveShareId(): string | undefined {
  return activeShareAttribution?.shareId
}

export function setActiveShareAttribution(
  shareAttribution: ShareAttribution | undefined
): void {
  activeShareAttribution = shareAttribution
}
