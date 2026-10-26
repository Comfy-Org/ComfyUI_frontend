import { isDesktop } from '@/platform/distribution/types'

export interface BillingTab {
  navigate(url: string): void
  close(): void
}

/**
 * Desktop denies every in-app popup and hands its URL to the system browser,
 * so `window.open` there always returns `null` even though the page opened.
 */
function handsPopupsToSystemBrowser(): boolean {
  return isDesktop || window.__comfyDesktop2 !== undefined
}

/** Opens a billing page in a new tab; `false` only when the browser blocked it. */
export function openBillingUrl(url: string): boolean {
  const tab = window.open(url, '_blank')
  return tab !== null || handsPopupsToSystemBrowser()
}

/**
 * Reserves a billing tab during the click, before its URL is known; `null`
 * when the browser blocked it. On Desktop the open waits for the URL.
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
