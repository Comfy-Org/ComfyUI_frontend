import { computed, onMounted, ref } from 'vue'

import type { TranslationKey } from '@/i18n/translations'

export type Platform = 'windows' | 'mac' | 'linux'

export const platformIcons: Record<Platform, string> = {
  windows: '/icons/os/windows.svg',
  mac: '/icons/os/apple.svg',
  linux: '/icons/os/linux.svg'
}

interface DesktopInstaller {
  platform: Platform
  url: string
  label: TranslationKey
}

export const installers = {
  windows: {
    platform: 'windows',
    url: 'https://comfy.org/download/windows/nsis/x64',
    label: 'download.hero.installers.windowsX64'
  },
  windowsArm: {
    platform: 'windows',
    url: 'https://comfy.org/download/windows/nsis/arm64',
    label: 'download.hero.installers.windowsArm64'
  },
  macArm: {
    platform: 'mac',
    url: 'https://download.comfy.org/mac/dmg/arm64',
    label: 'download.hero.installers.macArm64'
  },
  linux: {
    platform: 'linux',
    url: 'https://download.comfy.org/linux/appimage/x64',
    label: 'download.hero.installers.linuxX64'
  }
} as const satisfies Record<string, DesktopInstaller>

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

export function useDownloadUrl() {
  const platform = ref<Platform | null>(null)
  const detected = ref(false)
  const isMobileUa = ref(false)
  const armInstaller = ref(false)

  const installer = computed<DesktopInstaller | null>(() => {
    if (platform.value === 'windows') {
      return armInstaller.value ? installers.windowsArm : installers.windows
    }
    if (platform.value === 'mac') return installers.macArm
    if (platform.value === 'linux') return installers.linux
    return null
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

  return { installer, showFallback, isMobileUa }
}
