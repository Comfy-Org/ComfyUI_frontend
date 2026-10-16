import { isDesktop } from '@/platform/distribution/types'

export interface BillingTab {
  navigate(url: string): void
  close(): void
}

/**
 * Desktop denies every popup and hands its URL to the system browser, so a
 * blank tab opens nothing there and the `null` handle doesn't mean blocked.
 */
function handsPopupsToSystemBrowser(): boolean {
  return isDesktop || window.__comfyDesktop2 !== undefined
}

/**
 * Reserves a billing tab during the click, before its URL is known. On the
 * web this opens a blank tab while the click's activation still holds, with
 * `opener` cleared by hand because `noopener` would null the handle that tells
 * a blocked tab from an opened one. On Desktop the open waits for the URL.
 * Returns `null` when the browser blocked the tab.
 */
export function reserveBillingTab(): BillingTab | null {
  if (handsPopupsToSystemBrowser()) {
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

/** Opens `url` in a billing tab; `false` when the browser blocked it. */
export function openBillingUrl(url: string): boolean {
  const tab = window.open(url, '_blank')
  return tab !== null || handsPopupsToSystemBrowser()
}
