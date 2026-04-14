const downloadUrls = {
  windows: 'https://download.comfy.org/windows/nsis/x64',
  mac: 'https://download.comfy.org/mac/dmg/arm64'
} as const

function getDownloadUrl(): string {
  if (typeof navigator === 'undefined') return downloadUrls.windows
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('macintosh')) return downloadUrls.mac
  return downloadUrls.windows
}

export function useDownloadUrl() {
  return { downloadUrl: getDownloadUrl() }
}
