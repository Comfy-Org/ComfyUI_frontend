import { computed, onMounted, ref } from 'vue'

export const downloadUrl = 'https://dl.comfy.org'

export type Platform = 'windows' | 'mac' | 'linux'

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
  if (lowerUa.includes('linux')) return { platform: 'linux', isMobileUa }
  return { platform: null, isMobileUa }
}

export function useDownloadUrl() {
  const platform = ref<Platform | null>(null)
  const detected = ref(false)
  const isMobileUa = ref(false)

  const showDownload = computed(() => detected.value && !isMobileUa.value)

  onMounted(() => {
    const device = detectDevice(navigator.userAgent, navigator.maxTouchPoints)
    isMobileUa.value = device.isMobileUa
    platform.value = device.platform
    detected.value = true
  })

  return { platform, showDownload, isMobileUa }
}
