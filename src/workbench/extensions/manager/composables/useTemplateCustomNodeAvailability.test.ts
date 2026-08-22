import { describe, expect, it, vi } from 'vitest'

import type { TemplateCustomNodeAvailabilityDependencies as Dependencies } from './useTemplateCustomNodeAvailability'
import { useTemplateCustomNodeAvailability } from './useTemplateCustomNodeAvailability'

function createDependencies(
  overrides: Partial<Dependencies> = {}
): Dependencies {
  return {
    getManagerCapability: () => 'ready',
    listInstalledPacks: vi.fn().mockResolvedValue({}),
    isPackInstalling: () => false,
    listRegistryPacks: vi.fn().mockResolvedValue({
      nodes: [
        {
          id: 'package-id',
          status: 'NodeStatusActive',
          publisher: { name: 'Publisher' },
          latest_version: {
            version: '1.0.0',
            status: 'NodeVersionStatusActive'
          }
        }
      ],
      page: 1,
      total: 1,
      totalPages: 1
    }),
    getEnvironment: () => ({
      comfyui_version: '0.3.70',
      frontend_version: '1.30.0',
      os: 'darwin',
      accelerator: 'mps'
    }),
    ...overrides
  }
}

describe('template custom-node availability adapter', () => {
  it('resolves raw Manager inventory before exact Registry eligibility', async () => {
    const dependencies = createDependencies({
      listInstalledPacks: vi.fn().mockResolvedValue({
        'installed@1_0_0': {
          cnr_id: 'installed-id',
          enabled: false,
          ver: '1.0.0'
        },
        installed: {
          cnr_id: 'installed-id',
          enabled: true,
          ver: '2.0.0'
        }
      }),
      listRegistryPacks: vi.fn().mockResolvedValue({
        nodes: [
          {
            id: 'package-id',
            status: 'NodeStatusActive',
            publisher: { name: 'Publisher' },
            latest_version: {
              version: '1.0.0',
              status: 'NodeVersionStatusActive'
            }
          }
        ],
        page: 1,
        total: 1,
        totalPages: 1
      })
    })
    const { resolveAvailability } =
      useTemplateCustomNodeAvailability(dependencies)

    await expect(
      resolveAvailability(['installed-id', 'package-id'])
    ).resolves.toEqual([
      { id: 'installed-id', status: 'installed' },
      expect.objectContaining({ id: 'package-id', status: 'missing' })
    ])
    expect(dependencies.listRegistryPacks).toHaveBeenCalledWith(
      ['package-id'],
      undefined
    )
  })

  it.for(['disabled', 'legacy', 'incompatible'] as const)(
    'does not call Manager v4 or Registry while Manager is $0',
    async (managerCapability) => {
      const dependencies = createDependencies({
        getManagerCapability: () => managerCapability
      })
      const { resolveAvailability } =
        useTemplateCustomNodeAvailability(dependencies)

      await expect(resolveAvailability(['package-id'])).resolves.toEqual([
        { id: 'package-id', status: 'unknown' }
      ])
      expect(dependencies.listInstalledPacks).not.toHaveBeenCalled()
      expect(dependencies.listRegistryPacks).not.toHaveBeenCalled()
    }
  )

  it('keeps absence unknown after inventory, Registry, or abort failure', async () => {
    const inventoryFailure = createDependencies({
      listInstalledPacks: vi.fn().mockResolvedValue(null)
    })
    await expect(
      useTemplateCustomNodeAvailability(inventoryFailure).resolveAvailability([
        'package-id'
      ])
    ).resolves.toEqual([{ id: 'package-id', status: 'unknown' }])
    expect(inventoryFailure.listRegistryPacks).not.toHaveBeenCalled()

    const registryFailure = createDependencies({
      listRegistryPacks: vi.fn().mockResolvedValue(null)
    })
    await expect(
      useTemplateCustomNodeAvailability(registryFailure).resolveAvailability([
        'package-id'
      ])
    ).resolves.toEqual([{ id: 'package-id', status: 'unknown' }])

    const controller = new AbortController()
    controller.abort()
    const aborted = createDependencies()
    await expect(
      useTemplateCustomNodeAvailability(aborted).resolveAvailability(
        ['package-id'],
        controller.signal
      )
    ).resolves.toEqual([{ id: 'package-id', status: 'unknown' }])
    expect(aborted.listInstalledPacks).not.toHaveBeenCalled()
  })

  it('rejects incomplete or unsafe Registry evidence', async () => {
    const incomplete = createDependencies({
      listRegistryPacks: vi.fn().mockResolvedValue({
        nodes: [],
        page: 1,
        total: 1,
        totalPages: 2
      })
    })
    await expect(
      useTemplateCustomNodeAvailability(incomplete).resolveAvailability([
        'package-id'
      ])
    ).resolves.toEqual([{ id: 'package-id', status: 'unknown' }])

    const unsafe = createDependencies({
      listRegistryPacks: vi.fn().mockResolvedValue({
        nodes: [
          {
            id: 'package-id',
            status: 'NodeStatusBanned',
            latest_version: {
              version: '1.0.0',
              status: 'NodeVersionStatusActive'
            }
          }
        ],
        page: 1,
        total: 1,
        totalPages: 1
      })
    })
    await expect(
      useTemplateCustomNodeAvailability(unsafe).resolveAvailability([
        'package-id'
      ])
    ).resolves.toEqual([
      { id: 'package-id', status: 'unavailable', reason: 'unsafe' }
    ])
  })

  it('keeps compatibility unknown without required environment evidence', async () => {
    const dependencies = createDependencies({
      listRegistryPacks: vi.fn().mockResolvedValue({
        nodes: [
          {
            id: 'package-id',
            status: 'NodeStatusActive',
            supported_os: ['Windows'],
            publisher: { name: 'Publisher' },
            latest_version: {
              version: '1.0.0',
              status: 'NodeVersionStatusActive'
            }
          }
        ],
        page: 1,
        total: 1,
        totalPages: 1
      }),
      getEnvironment: () => ({})
    })

    await expect(
      useTemplateCustomNodeAvailability(dependencies).resolveAvailability([
        'package-id'
      ])
    ).resolves.toEqual([{ id: 'package-id', status: 'unknown' }])
  })
})
