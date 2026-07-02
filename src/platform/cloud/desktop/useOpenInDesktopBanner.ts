import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import { isCloud } from '@/platform/distribution/types'

const DISMISSED_STORAGE_KEY = 'comfy.openInDesktop.dismissed'

/** Public download page shown when the desktop app is not installed. */
export const DESKTOP_DOWNLOAD_URL = 'https://www.comfy.org/download'

function buildDeepLink(currentUrl: string): string {
  return `comfy://open?url=${encodeURIComponent(currentUrl)}`
}

/**
 * Drives the "Open in Comfy Desktop" banner shown on cloud.comfy.org when
 * viewed in a regular browser.
 *
 * The banner is visible only when all three gates pass:
 * 1. This is the cloud distribution build (`isCloud`).
 * 2. The page is not already embedded inside Comfy Desktop's cloud webview
 *    (`window.__comfyDesktop2Remote` is falsy).
 * 3. The user has not previously dismissed it (persisted in localStorage).
 */
export function useOpenInDesktopBanner() {
  const dismissed = useLocalStorage(DISMISSED_STORAGE_KEY, false)

  const isEmbeddedInDesktop = computed(() => !!window.__comfyDesktop2Remote)

  const visible = computed(
    () => isCloud && !isEmbeddedInDesktop.value && !dismissed.value
  )

  function openInDesktop(): void {
    window.location.href = buildDeepLink(window.location.href)
  }

  function dismiss(): void {
    dismissed.value = true
  }

  return {
    visible,
    openInDesktop,
    dismiss
  }
}
