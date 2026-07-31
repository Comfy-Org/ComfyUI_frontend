import { describe, expect, it } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import type { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import {
  getPackUpdateStatus,
  isNightlyVersion
} from '@/workbench/extensions/manager/utils/packUpdateStatus'

type NodePack = components['schemas']['Node']
type ComfyManagerStore = ReturnType<typeof useComfyManagerStore>

const createPack = (id: string | undefined, latestVersion?: string): NodePack =>
  ({
    id,
    name: `Pack ${id}`,
    latest_version: latestVersion ? { version: latestVersion } : undefined
  }) as NodePack

const createStore = (
  installed: Record<string, string | undefined>
): ComfyManagerStore =>
  ({
    isPackInstalled: (id: string | undefined) =>
      id !== undefined && id in installed,
    getInstalledPackVersion: (id: string) => installed[id]
  }) as unknown as ComfyManagerStore

describe('isNightlyVersion', () => {
  it('is true for a non-semver git hash version', () => {
    expect(isNightlyVersion('nightly-abc123')).toBe(true)
  })

  it('is false for a valid semver version', () => {
    expect(isNightlyVersion('1.2.3')).toBe(false)
  })

  it('is false for an undefined or empty version', () => {
    expect(isNightlyVersion(undefined)).toBe(false)
    expect(isNightlyVersion('')).toBe(false)
  })
})

describe('getPackUpdateStatus', () => {
  it('reports an update available when the latest version is newer', () => {
    const store = createStore({ 'pack-1': '1.0.0' })
    const status = getPackUpdateStatus(createPack('pack-1', '2.0.0'), store)

    expect(status).toEqual({
      isInstalled: true,
      installedVersion: '1.0.0',
      latestVersion: '2.0.0',
      isNightly: false,
      isUpdateAvailable: true
    })
  })

  it('reports no update when the installed version is up to date', () => {
    const store = createStore({ 'pack-1': '2.0.0' })
    const status = getPackUpdateStatus(createPack('pack-1', '2.0.0'), store)

    expect(status.isUpdateAvailable).toBe(false)
  })

  it('never reports an update for a nightly (non-semver) install', () => {
    const store = createStore({ 'pack-1': 'nightly-abc123' })
    const status = getPackUpdateStatus(createPack('pack-1', '2.0.0'), store)

    expect(status.isNightly).toBe(true)
    expect(status.isUpdateAvailable).toBe(false)
  })

  it('reports no update when the pack is not installed', () => {
    const store = createStore({})
    const status = getPackUpdateStatus(createPack('pack-1', '2.0.0'), store)

    expect(status.isInstalled).toBe(false)
    expect(status.isUpdateAvailable).toBe(false)
  })

  it('reports no update when the latest version is not valid semver', () => {
    const store = createStore({ 'pack-1': '1.0.0' })
    const status = getPackUpdateStatus(createPack('pack-1', 'deadbeef'), store)

    expect(status.isUpdateAvailable).toBe(false)
  })

  it('reports no update for an installed pack with no known version', () => {
    const store = createStore({ 'pack-1': undefined })
    const status = getPackUpdateStatus(createPack('pack-1', '2.0.0'), store)

    expect(status.isInstalled).toBe(true)
    expect(status.installedVersion).toBeUndefined()
    expect(status.isUpdateAvailable).toBe(false)
  })

  it('reports no update when the pack has no latest version', () => {
    const store = createStore({ 'pack-1': '1.0.0' })
    const status = getPackUpdateStatus(createPack('pack-1'), store)

    expect(status.latestVersion).toBeUndefined()
    expect(status.isUpdateAvailable).toBe(false)
  })
})
