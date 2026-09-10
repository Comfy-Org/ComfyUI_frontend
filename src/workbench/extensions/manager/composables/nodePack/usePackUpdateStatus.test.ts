import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { usePackUpdateStatus } from '@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

type NodePack = components['schemas']['Node']
type ManagerStoreReturn = ReturnType<typeof useComfyManagerStore>

let mockIsPackInstalled: ReturnType<
  typeof vi.mocked<ManagerStoreReturn['isPackInstalled']>
>
let mockIsPackEnabled: ReturnType<
  typeof vi.mocked<ManagerStoreReturn['isPackEnabled']>
>
let mockGetInstalledPackVersion: ReturnType<
  typeof vi.mocked<ManagerStoreReturn['getInstalledPackVersion']>
>

function makePack(overrides: Partial<NodePack> = {}): NodePack {
  return {
    id: 'pack-1',
    name: 'Pack',
    latest_version: { version: '2.0.0' },
    ...overrides
  }
}

beforeEach(() => {
  const store = useComfyManagerStore()
  mockIsPackInstalled = vi.mocked(store.isPackInstalled)
  mockIsPackEnabled = vi.mocked(store.isPackEnabled)
  mockGetInstalledPackVersion = vi.mocked(store.getInstalledPackVersion)
  mockIsPackInstalled.mockReturnValue(true)
  mockIsPackEnabled.mockReturnValue(true)
  mockGetInstalledPackVersion.mockReturnValue('1.0.0')
})

describe('usePackUpdateStatus', () => {
  it('reports an update when the latest release is newer', () => {
    const { isUpdateAvailable, installedVersion, latestVersion } =
      usePackUpdateStatus(makePack())

    expect(isUpdateAvailable.value).toBe(true)
    expect(installedVersion.value).toBe('1.0.0')
    expect(latestVersion.value).toBe('2.0.0')
  })

  it('reports no update when installed matches latest', () => {
    mockGetInstalledPackVersion.mockReturnValue('2.0.0')

    const { isUpdateAvailable } = usePackUpdateStatus(makePack())

    expect(isUpdateAvailable.value).toBe(false)
  })

  it('reports no update when the pack is not installed', () => {
    mockIsPackInstalled.mockReturnValue(false)

    const { isUpdateAvailable } = usePackUpdateStatus(makePack())

    expect(isUpdateAvailable.value).toBe(false)
  })

  it('treats a non-semver installed version as a nightly build', () => {
    mockGetInstalledPackVersion.mockReturnValue('abc1234')

    const { isNightlyPack, isUpdateAvailable, canTryNightlyUpdate } =
      usePackUpdateStatus(makePack())

    expect(isNightlyPack.value).toBe(true)
    expect(isUpdateAvailable.value).toBe(false)
    expect(canTryNightlyUpdate.value).toBe(true)
  })

  it('only allows a nightly update when installed and enabled', () => {
    mockGetInstalledPackVersion.mockReturnValue('abc1234')
    mockIsPackEnabled.mockReturnValue(false)

    const { canTryNightlyUpdate } = usePackUpdateStatus(makePack())

    expect(canTryNightlyUpdate.value).toBe(false)
  })

  it('reports no update when the registry omits a latest version', () => {
    const { isUpdateAvailable } = usePackUpdateStatus(
      makePack({ latest_version: undefined })
    )

    expect(isUpdateAvailable.value).toBe(false)
  })

  it('recomputes when the source pack changes', async () => {
    const source = ref(makePack({ latest_version: { version: '1.0.0' } }))
    const { isUpdateAvailable } = usePackUpdateStatus(source)

    expect(isUpdateAvailable.value).toBe(false)

    source.value = makePack({ latest_version: { version: '3.0.0' } })
    await nextTick()

    expect(isUpdateAvailable.value).toBe(true)
  })
})
