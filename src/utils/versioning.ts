import { electronAPI, isElectron } from '@/utils/envUtil'

/**
 * Compare two semantic version strings.
 * @param a - First version string
 * @param b - Second version string
 * @returns 0 if equal, 1 if a > b, -1 if a < b
 */
export function compareVersions(a: string, b: string): number {
  const parseVersion = (version: string) => {
    return version.split('.').map((v) => parseInt(v, 10) || 0)
  }

  const versionA = parseVersion(a)
  const versionB = parseVersion(b)

  for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
    const numA = versionA[i] || 0
    const numB = versionB[i] || 0

    if (numA > numB) return 1
    if (numA < numB) return -1
  }

  return 0
}

/**
 * Get the current ComfyUI version for version tracking
 */
export function getCurrentVersion(): string {
  if (isElectron()) {
    return electronAPI().getComfyUIVersion()
  }
  // For web version, fallback to frontend version
  return __COMFYUI_FRONTEND_VERSION__
}
