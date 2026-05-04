import { computed, onMounted, ref } from 'vue'

import { externalLinks } from '@/config/routes'

const downloadUrls = {
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

  const downloadUrl = computed(() => {
    if (platform.value === 'windows') return downloadUrls.windows
    if (platform.value === 'mac') return downloadUrls.macArm
    return externalLinks.github
  })

  onMounted(() => {
    platform.value = detectPlatform(navigator.userAgent.toLowerCase())
  })

  return { downloadUrl, platform }
}
