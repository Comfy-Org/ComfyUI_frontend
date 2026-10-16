import { isDesktop } from '@/platform/distribution/types'

export interface BillingTab {
  navigate(url: string): void
  close(): void
}

/**
 * Reserves a billing tab during the click, before its URL is known; `null`
 * when the browser blocked it. Desktop hands popups to the system browser, so
 * there the open waits for the URL and its `null` handle is not a block.
 */
export function reserveBillingTab(): BillingTab | null {
  if (isDesktop || window.__comfyDesktop2 !== undefined) {
    return {
      navigate: (url) => {
        window.open(url, '_blank')
      },
      close: () => {}
    }
  }
  const tab = window.open('', '_blank')
  if (!tab) return null
  tab.opener = null
  return {
    navigate: (url) => {
      tab.location.href = url
    },
    close: () => tab.close()
  }
}
