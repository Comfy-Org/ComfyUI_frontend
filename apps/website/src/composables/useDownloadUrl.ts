import { computed, onMounted, ref } from 'vue'

import { externalLinks } from '@/config/routes'

export const downloadUrls = {
  windows: 'https://download.comfy.org/windows/nsis/x64',
  macArm: 'https://download.comfy.org/mac/dmg/arm64'
} as const

type DetectedPlatform = 'windows' | 'mac' | null

function isMobile(ua: string): boolean {
  return /iphone|ipad|ipod|android/.test(ua)
}

function detectPlatform(ua: string): DetectedPlatform {
  if (isMobile(ua)) return null
  if (ua.includes('win')) return 'windows'
  if (ua.includes('macintosh') || ua.includes('mac os x')) return 'mac'
  return null
}

// TODO: Only Windows x64 and macOS arm64 are available today.
// When Linux and/or macIntel builds are added, extend detection and URLs here.
export function useDownloadUrl() {
  const platform = ref<DetectedPlatform>(null)
  const detected = ref(false)
  // Mobile users can't install a desktop build — keep them on the
  // GitHub-install path instead of showing dmg/exe buttons that won't run.
  const isMobileUa = ref(false)

  const downloadUrl = computed(() => {
    if (platform.value === 'windows') return downloadUrls.windows
    if (platform.value === 'mac') return downloadUrls.macArm
    return externalLinks.github
  })

  /** True only when the UA check ran, found no match, AND the user is on a
   *  desktop UA. Drives the Windows+Mac fallback so users on Linux or with
   *  privacy-stripped UAs aren't stranded with nothing to click. */
  const showFallback = computed(
    () => detected.value && !platform.value && !isMobileUa.value
  )

  onMounted(() => {
    const ua = navigator.userAgent.toLowerCase()
    isMobileUa.value = isMobile(ua)
    platform.value = detectPlatform(ua)
    detected.value = true
  })

  return { downloadUrl, platform, detected, showFallback }
}
