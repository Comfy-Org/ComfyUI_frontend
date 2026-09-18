import { compare, valid } from 'semver'

import type { components } from '@/types/comfyRegistryTypes'
type NodePack = components['schemas']['Node']
interface PackVersionStore {
  isPackInstalled(id: string | undefined): boolean
  getInstalledPackVersion(id: string): string | undefined
}

interface PackUpdateStatus {
  isInstalled: boolean
  installedVersion: string | undefined
  latestVersion: string | undefined
  isNightly: boolean
  isUpdateAvailable: boolean
}

/**
 * A pack is a nightly build when its installed version is not valid semver
 * (a git hash), so it cannot be compared against the latest release version.
 */
export function isNightlyVersion(version: string | undefined): boolean {
  return !!version && !valid(version)
}

/**
 * Derives the update status of a pack from its installed version and the
 * latest release version advertised by the registry. A nightly build is never
 * "outdated" since git hashes cannot be ordered.
 */
export function getPackUpdateStatus(
  pack: NodePack | undefined,
  managerStore: PackVersionStore
): PackUpdateStatus {
  const isInstalled = managerStore.isPackInstalled(pack?.id)
  const installedVersion = managerStore.getInstalledPackVersion(pack?.id ?? '')
  const latestVersion = pack?.latest_version?.version
  const isNightly = isNightlyVersion(installedVersion)

  const isUpdateAvailable =
    isInstalled &&
    !isNightly &&
    !!installedVersion &&
    !!latestVersion &&
    !!valid(latestVersion) &&
    compare(latestVersion, installedVersion) > 0

  return {
    isInstalled,
    installedVersion,
    latestVersion,
    isNightly,
    isUpdateAvailable
  }
}
