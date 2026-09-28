import { computed, onMounted, ref } from 'vue'

import { externalLinks } from '@/config/routes'

export const downloadUrls = {
  windows: 'https://comfy.org/download/windows/nsis/x64',
  windowsArm: 'https://comfy.org/download/windows/nsis/arm64',
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

// Windows on ARM browsers still send an x64 UA string, so the CPU is only
// visible through User-Agent Client Hints (Chromium-based browsers).
async function isArmCpu(
  userAgentData: NavigatorUAData | undefined
): Promise<boolean> {
  if (!userAgentData) return false
  try {
    const { architecture } = await userAgentData.getHighEntropyValues([
      'architecture'
    ])
    return architecture === 'arm'
  } catch {
    return false
  }
}

function hasNvidiaGpu(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return false
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return /nvidia/i.test(String(renderer))
  } catch {
    return false
  }
}

// The arm64 desktop build only ships an NVIDIA runtime; other ARM PCs
// (Snapdragon) need the x64 build, which runs emulated on a CPU runtime.
async function needsArmInstaller(): Promise<boolean> {
  return (await isArmCpu(navigator.userAgentData)) && hasNvidiaGpu()
}

// TODO: Only Windows x64/arm64 and macOS arm64 are available today.
// When Linux and/or macIntel builds are added, extend detection and URLs here.
export function useDownloadUrl() {
  const platform = ref<Platform | null>(null)
  const detected = ref(false)
  const isMobileUa = ref(false)
  const armInstaller = ref(false)

  const downloadUrl = computed(() => {
    if (platform.value === 'windows') {
      return armInstaller.value ? downloadUrls.windowsArm : downloadUrls.windows
    }
    if (platform.value === 'mac') return downloadUrls.macArm
    return externalLinks.github
  })

  const showFallback = computed(
    () => detected.value && !platform.value && !isMobileUa.value
  )

  onMounted(async () => {
    const device = detectDevice(navigator.userAgent, navigator.maxTouchPoints)
    if (device.platform === 'windows') {
      armInstaller.value = await needsArmInstaller()
    }
    isMobileUa.value = device.isMobileUa
    platform.value = device.platform
    detected.value = true
  })

  return { downloadUrl, platform, showFallback, isMobileUa }
}
