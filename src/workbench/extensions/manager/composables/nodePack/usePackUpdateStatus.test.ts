import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { usePackUpdateStatus } from '@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus'

type NodePack = components['schemas']['Node']

const { managerStore } = vi.hoisted(() => ({
  managerStore: {
    isPackInstalled: vi.fn(),
    isPackEnabled: vi.fn(),
    getInstalledPackVersion: vi.fn()
  }
}))

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => managerStore
}))

function pack(overrides: Partial<NodePack> = {}): NodePack {
  return {
    id: 'pack-a',
    latest_version: { version: '1.2.0' },
    ...overrides
  } as NodePack
}

beforeEach(() => {
  managerStore.isPackInstalled.mockReset().mockReturnValue(true)
  managerStore.isPackEnabled.mockReset().mockReturnValue(true)
  managerStore.getInstalledPackVersion.mockReset().mockReturnValue('1.0.0')
})

describe('usePackUpdateStatus', () => {
  it('detects semver updates for installed packs', () => {
    const status = usePackUpdateStatus(pack())

    expect(status.installedVersion.value).toBe('1.0.0')
    expect(status.latestVersion.value).toBe('1.2.0')
    expect(status.isNightlyPack.value).toBe(false)
    expect(status.isUpdateAvailable.value).toBe(true)
    expect(status.canTryNightlyUpdate.value).toBe(false)
  })

  it('blocks update prompts when required version data is absent', () => {
    managerStore.isPackInstalled.mockReturnValue(false)
    expect(usePackUpdateStatus(pack()).isUpdateAvailable.value).toBe(false)

    managerStore.isPackInstalled.mockReturnValue(true)
    managerStore.getInstalledPackVersion.mockReturnValue('')
    expect(usePackUpdateStatus(pack()).isUpdateAvailable.value).toBe(false)

    managerStore.getInstalledPackVersion.mockReturnValue('1.0.0')
    expect(
      usePackUpdateStatus(pack({ latest_version: undefined })).isUpdateAvailable
        .value
    ).toBe(false)
  })

  it('allows enabled nightly packs to try update without semver comparison', () => {
    managerStore.getInstalledPackVersion.mockReturnValue('nightly')

    const status = usePackUpdateStatus(pack())

    expect(status.isNightlyPack.value).toBe(true)
    expect(status.isUpdateAvailable.value).toBe(false)
    expect(status.canTryNightlyUpdate.value).toBe(true)
  })

  it('tracks reactive pack sources', () => {
    const nodePack = ref(pack({ latest_version: { version: '1.0.0' } }))
    const status = usePackUpdateStatus(nodePack)

    expect(status.isUpdateAvailable.value).toBe(false)

    nodePack.value = pack({ latest_version: { version: '2.0.0' } })

    expect(status.latestVersion.value).toBe('2.0.0')
    expect(status.isUpdateAvailable.value).toBe(true)
  })
})
