import { externalLinks } from '@/config/routes'

const downloadUrls = {
  windows: 'https://download.comfy.org/windows/nsis/x64',
  macArm: 'https://download.comfy.org/mac/dmg/arm64'
} as const

function isMobile(ua: string): boolean {
  return /iphone|ipad|ipod|android/.test(ua)
}

// TODO: Only Windows x64 and macOS arm64 are available today.
// When Linux and/or macIntel builds are added, extend detection and URLs here.
function getDownloadUrl(): string {
  if (typeof navigator === 'undefined') return externalLinks.github

  const ua = navigator.userAgent.toLowerCase()
  if (isMobile(ua)) return externalLinks.github
  if (ua.includes('win')) return downloadUrls.windows
  if (ua.includes('macintosh') || ua.includes('mac os x'))
    return downloadUrls.macArm

  return externalLinks.github
}

export function useDownloadUrl() {
  return { downloadUrl: getDownloadUrl() }
}
