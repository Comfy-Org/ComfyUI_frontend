import { computed, onMounted, ref } from 'vue'

import { externalLinks } from '@/config/routes'

export const downloadUrls = {
  windows: 'https://dl.comfy.org/windows/nsis/x64',
  windowsArm: 'https://dl.comfy.org/windows/nsis/arm64',
  macArm: 'https://dl.comfy.org/mac/dmg/arm64',
  linux: 'https://dl.comfy.org/linux/appimage/x64',
  linuxArm: 'https://dl.comfy.org/linux/appimage/arm64'
} as const

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
  // Android is already out above, and ChromeOS reports "CrOS", never "Linux".
  if (lowerUa.includes('linux')) return { platform: 'linux', isMobileUa }
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
    try {
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : ''
      return /nvidia/i.test(String(renderer))
    } finally {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    return false
  }
}

// The arm64 desktop build only ships an NVIDIA runtime; other ARM PCs
// (Snapdragon) need the x64 build, which runs emulated on a CPU runtime.
async function needsArmInstaller(): Promise<boolean> {
  return (await isArmCpu(navigator.userAgentData)) && hasNvidiaGpu()
}

// TODO: macOS has no x64 build, so Intel Macs are handed the arm64 dmg.
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
    if (platform.value === 'linux') {
      return armInstaller.value ? downloadUrls.linuxArm : downloadUrls.linux
    }
    return externalLinks.github
  })

  const showFallback = computed(
    () => detected.value && !platform.value && !isMobileUa.value
  )

  onMounted(async () => {
    const device = detectDevice(navigator.userAgent, navigator.maxTouchPoints)
    if (device.platform === 'windows') {
      armInstaller.value = await needsArmInstaller()
    } else if (device.platform === 'linux') {
      // Linux ships a plain arm64 AppImage, so no GPU runtime caveat applies.
      armInstaller.value = await isArmCpu(navigator.userAgentData)
    }
    isMobileUa.value = device.isMobileUa
    platform.value = device.platform
    detected.value = true
  })

  return { downloadUrl, platform, showFallback, isMobileUa }
}
