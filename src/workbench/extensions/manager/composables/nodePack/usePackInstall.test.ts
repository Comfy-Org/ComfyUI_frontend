import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { usePackInstall } from '@/workbench/extensions/manager/composables/nodePack/usePackInstall'

type NodePack = components['schemas']['Node']

const { managerStore, showDialog, checkNodeCompatibility } = vi.hoisted(() => ({
  managerStore: {
    installPack: { call: vi.fn(), clear: vi.fn() },
    isPackInstalling: vi.fn((_id?: string) => false),
    isPackInstalled: vi.fn((_id?: string) => false)
  },
  showDialog: vi.fn(),
  checkNodeCompatibility: vi.fn(() => ({ hasConflict: false, conflicts: [] }))
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => managerStore
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useNodeConflictDialog',
  () => ({
    useNodeConflictDialog: () => ({ show: showDialog })
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({ checkNodeCompatibility })
  })
)

function pack(over: Partial<NodePack> = {}): NodePack {
  return { id: 'pack-a', name: 'Pack A', ...over } as NodePack
}

beforeEach(() => {
  managerStore.installPack.call.mockReset().mockResolvedValue(undefined)
  managerStore.installPack.clear.mockReset()
  managerStore.isPackInstalling.mockReset().mockReturnValue(false)
  managerStore.isPackInstalled.mockReset().mockReturnValue(false)
  showDialog.mockReset()
  checkNodeCompatibility.mockReset().mockReturnValue({
    hasConflict: false,
    conflicts: []
  })
})

describe('usePackInstall', () => {
  it('reports isInstalling when any pack is installing', () => {
    managerStore.isPackInstalling.mockImplementation(
      (id?: string) => id === 'pack-b'
    )
    const { isInstalling } = usePackInstall(() => [
      pack(),
      pack({ id: 'pack-b' })
    ])
    expect(isInstalling.value).toBe(true)
  })

  it('reports not installing for an empty or idle pack list', () => {
    expect(usePackInstall(() => []).isInstalling.value).toBe(false)
    expect(usePackInstall(() => [pack()]).isInstalling.value).toBe(false)
  })

  it('installs each pack and clears the command afterward', async () => {
    const { performInstallation } = usePackInstall(() => [])
    await performInstallation([
      pack({
        id: 'a',
        latest_version: { version: '1.2.0' }
      } as Partial<NodePack>),
      pack({ id: 'b', publisher: { name: 'Unclaimed' } } as Partial<NodePack>)
    ])

    expect(managerStore.installPack.call).toHaveBeenCalledTimes(2)
    expect(managerStore.installPack.call).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', selected_version: '1.2.0' })
    )
    expect(managerStore.installPack.call).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b', selected_version: 'nightly' })
    )
    expect(managerStore.installPack.clear).toHaveBeenCalled()
  })

  it('installAllPacks installs only the not-yet-installed packs', async () => {
    managerStore.isPackInstalled.mockImplementation(
      (id?: string) => id === 'installed'
    )
    const { installAllPacks } = usePackInstall(() => [
      pack({ id: 'installed' }),
      pack({ id: 'fresh' })
    ])

    await installAllPacks()

    expect(managerStore.installPack.call).toHaveBeenCalledTimes(1)
    expect(managerStore.installPack.call).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fresh' })
    )
  })

  it('installAllPacks opens the conflict dialog instead of installing when conflicted', async () => {
    checkNodeCompatibility.mockReturnValue({
      hasConflict: true,
      conflicts: [{ type: 'os' }]
    } as never)
    const { installAllPacks } = usePackInstall(
      () => [pack({ id: 'x' })],
      () => true,
      () => [{ type: 'os' } as never]
    )

    await installAllPacks()

    expect(showDialog).toHaveBeenCalledTimes(1)
    expect(managerStore.installPack.call).not.toHaveBeenCalled()
  })
})
