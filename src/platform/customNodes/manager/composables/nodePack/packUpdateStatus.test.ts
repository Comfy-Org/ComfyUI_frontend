import { describe, expect, it } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import type { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'
import {
  getPackUpdateStatus,
  isNightlyVersion
} from '@/platform/customNodes/manager/composables/nodePack/packUpdateStatus'

type NodePack = components['schemas']['Node']
type ComfyManagerStore = Pick<
  ReturnType<typeof useComfyManagerStore>,
  'isPackInstalled' | 'getInstalledPackVersion'
>

const createPack = (
  id: string | undefined,
  latestVersion?: string
): NodePack => ({
  id,
  name: `Pack ${id}`,
  latest_version: latestVersion
    ? { version: latestVersion, status: 'NodeVersionStatusActive' }
    : undefined
})

const createStore = (
  installed: Record<string, string | undefined>
): ComfyManagerStore => ({
  isPackInstalled: (id: string | undefined) =>
    id !== undefined && id in installed,
  getInstalledPackVersion: (id: string) => installed[id]
})

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
  it.for([
    'NodeVersionStatusPending',
    'NodeVersionStatusFlagged',
    'NodeVersionStatusBanned'
  ] as const)(
    'does not advertise a %s release as a default update',
    (status) => {
      const pack = createPack('pack-1', '3.0.0')
      pack.latest_version = { version: '3.0.0', status }
      expect(
        getPackUpdateStatus(pack, createStore({ 'pack-1': '2.0.0' }))
          .isUpdateAvailable
      ).toBe(false)
    }
  )

  it.for([
    ['1.0.0', true],
    ['2.0.0', false],
    ['2.5.0', false]
  ] as const)(
    'compares installed %s with the resolved Active release',
    ([installed, expected]) => {
      const pack: NodePack = {
        id: 'pack-1',
        latest_version: { version: '3.0.0', status: 'NodeVersionStatusFlagged' }
      }
      const status = getPackUpdateStatus(
        pack,
        createStore({ 'pack-1': installed }),
        {
          version: '2.0.0',
          status: 'NodeVersionStatusActive'
        }
      )
      expect(status.latestVersion).toBe('2.0.0')
      expect(status.isUpdateAvailable).toBe(expected)
    }
  )
})
