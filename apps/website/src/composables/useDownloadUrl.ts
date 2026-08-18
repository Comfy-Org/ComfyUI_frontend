import { computed, onMounted, ref } from 'vue'

import { externalLinks } from '@/config/routes'

export const downloadUrls = {
  windows: 'https://comfy.org/download/windows/nsis/x64',
  macArm: 'https://download.comfy.org/mac/dmg/arm64'
} as const

export type Platform = 'windows' | 'mac'

export interface DetectedDevice {
  platform: Platform | null
  isMobileUa: boolean
}

// iPadOS Safari sends a Macintosh desktop UA by default; real Macs report no
// touch points, so a "Mac" with a touchscreen is an iPad.
export function detectDevice(
  ua: string,
  maxTouchPoints: number
): DetectedDevice {
  const lowerUa = ua.toLowerCase()
  const isIpadOs = lowerUa.includes('macintosh') && maxTouchPoints > 1
  const isMobileUa = /iphone|ipad|ipod|android/.test(lowerUa) || isIpadOs
  if (isMobileUa) return { platform: null, isMobileUa }
  if (lowerUa.includes('win')) return { platform: 'windows', isMobileUa }
  if (lowerUa.includes('macintosh') || lowerUa.includes('mac os x')) {
    return { platform: 'mac', isMobileUa }
  }
  return { platform: null, isMobileUa }
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
    const device = detectDevice(navigator.userAgent, navigator.maxTouchPoints)
    isMobileUa.value = device.isMobileUa
    platform.value = device.platform
    detected.value = true
  })

  return { downloadUrl, platform, showFallback, isMobileUa }
}
