import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { usePackInstall } from '@/workbench/extensions/manager/composables/nodePack/usePackInstall'
import type { ConflictDetail } from '@/workbench/extensions/manager/types/conflictDetectionTypes'

type NodePack = components['schemas']['Node']
type CompatibilityCheck = {
  hasConflict: boolean
  conflicts: ConflictDetail[]
}

const { managerStore, showDialog, checkNodeCompatibility } = vi.hoisted(() => ({
  managerStore: {
    installPack: { call: vi.fn(), clear: vi.fn() },
    isPackInstalling: vi.fn((_id?: string) => false),
    isPackInstalled: vi.fn((_id?: string) => false)
  },
  showDialog: vi.fn(),
  checkNodeCompatibility: vi.fn(
    (): CompatibilityCheck => ({ hasConflict: false, conflicts: [] })
  )
}))

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
  return fromPartial<NodePack>({ id: 'pack-a', name: 'Pack A', ...over })
}

function conflict(overrides: Partial<ConflictDetail> = {}): ConflictDetail {
  return {
    type: 'os',
    current_value: 'linux',
    required_value: 'darwin',
    ...overrides
  }
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

  it('installAllPacks returns early for empty or already installed packs', async () => {
    await usePackInstall(() => []).installAllPacks()

    managerStore.isPackInstalled.mockReturnValue(true)
    await usePackInstall(() => [pack({ id: 'installed' })]).installAllPacks()

    expect(managerStore.installPack.call).not.toHaveBeenCalled()
    expect(managerStore.installPack.clear).not.toHaveBeenCalled()
  })

  it('installAllPacks opens the conflict dialog instead of installing when conflicted', async () => {
    const osConflict = conflict()
    checkNodeCompatibility.mockReturnValue({
      hasConflict: true,
      conflicts: [osConflict]
    })
    const { installAllPacks } = usePackInstall(
      () => [pack({ id: 'x' })],
      () => true,
      () => [osConflict]
    )

    await installAllPacks()

    expect(showDialog).toHaveBeenCalledTimes(1)
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictedPackages: [
          expect.objectContaining({
            package_id: 'x',
            package_name: 'Pack A',
            has_conflict: true,
            conflicts: [osConflict],
            is_compatible: false
          })
        ]
      })
    )
    expect(managerStore.installPack.call).not.toHaveBeenCalled()
  })

  it('installAllPacks stops when conflict details are unavailable', async () => {
    const { installAllPacks } = usePackInstall(
      () => [pack({ id: 'x' })],
      () => true
    )

    await installAllPacks()

    expect(showDialog).not.toHaveBeenCalled()
    expect(managerStore.installPack.call).not.toHaveBeenCalled()
  })

  it('conflict dialog payload falls back for unnamed package data', async () => {
    checkNodeCompatibility.mockReturnValue({
      hasConflict: true,
      conflicts: [conflict()]
    })
    const { installAllPacks } = usePackInstall(
      () => [pack({ id: undefined, name: undefined })],
      () => true,
      () => [conflict()]
    )

    await installAllPacks()

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictedPackages: [
          expect.objectContaining({
            package_id: '',
            package_name: ''
          })
        ]
      })
    )
  })

  it('conflict dialog action installs only packs still missing', async () => {
    checkNodeCompatibility.mockReturnValue({
      hasConflict: false,
      conflicts: []
    })
    managerStore.isPackInstalled.mockImplementation(
      (id?: string) => id === 'installed'
    )
    const { installAllPacks } = usePackInstall(
      () => [pack({ id: 'installed' }), pack({ id: 'fresh' })],
      () => true,
      () => [conflict()]
    )

    await installAllPacks()
    const [{ onButtonClick }] = showDialog.mock.calls[0]
    await onButtonClick()

    expect(managerStore.installPack.call).toHaveBeenCalledTimes(1)
    expect(managerStore.installPack.call).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fresh' })
    )
    expect(managerStore.installPack.clear).toHaveBeenCalledTimes(1)
  })

  it('conflict dialog action returns when every pack is already installed', async () => {
    managerStore.isPackInstalled.mockReturnValue(true)
    const { installAllPacks } = usePackInstall(
      () => [pack({ id: 'installed' })],
      () => true,
      () => [conflict()]
    )

    await installAllPacks()
    const [{ onButtonClick }] = showDialog.mock.calls[0]
    await onButtonClick()

    expect(managerStore.installPack.call).not.toHaveBeenCalled()
    expect(managerStore.installPack.clear).not.toHaveBeenCalled()
  })

  it('clears the command when payload validation rejects', async () => {
    const { performInstallation } = usePackInstall(() => [])

    await expect(
      performInstallation([pack({ id: undefined })])
    ).rejects.toThrow('Node ID is required for installation')

    expect(managerStore.installPack.call).not.toHaveBeenCalled()
    expect(managerStore.installPack.clear).toHaveBeenCalledTimes(1)
  })

  it('leaves command cleanup in finally when one install fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    managerStore.installPack.call
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('failed'))
    const { performInstallation } = usePackInstall(() => [])

    await performInstallation([pack({ id: 'a' }), pack({ id: 'b' })])

    expect(consoleError).toHaveBeenCalledWith(
      '[usePackInstall] Some installations failed:',
      [expect.any(Error)]
    )
    expect(managerStore.installPack.clear).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })
})
