import { computed, onMounted, ref } from 'vue'

import { externalLinks } from '@/config/routes'

export const downloadUrls = {
  windows: 'https://download.comfy.org/windows/nsis/x64',
  macArm: 'https://download.comfy.org/mac/dmg/arm64'
} as const

export type Platform = 'windows' | 'mac'

function isMobile(ua: string): boolean {
  return /iphone|ipad|ipod|android/.test(ua)
}

function detectPlatform(ua: string): Platform | null {
  if (isMobile(ua)) return null
  if (ua.includes('win')) return 'windows'
  if (ua.includes('macintosh') || ua.includes('mac os x')) return 'mac'
  return null
}

// TODO: Only Windows x64 and macOS arm64 are available today.
// When Linux and/or macIntel builds are added, extend detection and URLs here.
export function useDownloadUrl() {
  const platform = ref<Platform | null>(null)
  const detected = ref(false)
  const isMobileUa = ref(false)

  const downloadUrl = computed(() => {
    if (platform.value === 'windows') return downloadUrls.windows
    if (platform.value === 'mac') return downloadUrls.macArm
    return externalLinks.github
  })

  const showFallback = computed(
    () => detected.value && !platform.value && !isMobileUa.value
  )

  onMounted(() => {
    const ua = navigator.userAgent.toLowerCase()
    isMobileUa.value = isMobile(ua)
    platform.value = detectPlatform(ua)
    detected.value = true
  })

  return { downloadUrl, platform, showFallback }
}
