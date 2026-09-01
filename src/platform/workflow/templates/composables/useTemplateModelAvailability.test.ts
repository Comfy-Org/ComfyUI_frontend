import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import type * as ModelStoreModule from '@/stores/modelStore'
import { ResourceState } from '@/stores/modelStore'
import { useTemplateModelAvailability } from './useTemplateModelAvailability'

const mockModelStore = vi.hoisted(() => ({
  loadModels: vi.fn<() => Promise<unknown[]>>(),
  loadModelFolders: vi.fn<() => Promise<boolean>>(),
  getLoadedModelFolder:
    vi.fn<
      (
        directory: string
      ) => Promise<{ directory: string; state: number } | null>
    >(),
  modelFolders: [] as Array<{ directory: string; state: number }>,
  models: [] as Array<{ directory: string; normalized_file_name: string }>
}))

const mocks = vi.hoisted(() => ({ reportError: vi.fn() }))

vi.mock('@/stores/modelStore', async (importOriginal) => ({
  ...(await importOriginal<typeof ModelStoreModule>()),
  useModelStore: () => mockModelStore
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mocks.reportError
}))

function model(name: string, directory = 'checkpoints'): ModelFile {
  return {
    name,
    directory,
    url: `https://example.com/${name}`
  }
}

describe('useTemplateModelAvailability', () => {
  beforeEach(() => {
    mockModelStore.modelFolders = []
    mockModelStore.models = []
    mockModelStore.loadModels.mockReset()
    mockModelStore.loadModels.mockResolvedValue([])
    mockModelStore.loadModelFolders.mockReset()
    mockModelStore.loadModelFolders.mockResolvedValue(true)
    mockModelStore.getLoadedModelFolder.mockReset()
    mockModelStore.getLoadedModelFolder.mockImplementation(
      async (directory) =>
        mockModelStore.modelFolders.find(
          (folder) => folder.directory === directory
        ) ?? null
    )
    mocks.reportError.mockReset()
  })

  it('loads only referenced directories before classifying a complete snapshot', async () => {
    const installed = model('installed.safetensors')
    const missing = model('missing.safetensors')
    mockModelStore.modelFolders = [
      { directory: 'checkpoints', state: ResourceState.Loaded },
      { directory: 'controlnet', state: ResourceState.Loaded }
    ]
    mockModelStore.models = [
      {
        directory: installed.directory,
        normalized_file_name: installed.name
      }
    ]

    await expect(
      useTemplateModelAvailability().resolveAvailability([installed, missing])
    ).resolves.toEqual([
      { model: installed, status: 'installed' },
      { model: missing, status: 'missing' }
    ])
    expect(mockModelStore.getLoadedModelFolder).toHaveBeenCalledExactlyOnceWith(
      'checkpoints'
    )
    expect(mockModelStore.loadModelFolders).not.toHaveBeenCalled()
    expect(mockModelStore.loadModels).not.toHaveBeenCalled()
  })

  it('keeps absence unknown when the model-folder registry is empty', async () => {
    const unresolved = model('unresolved.safetensors')

    await expect(
      useTemplateModelAvailability().resolveAvailability([unresolved])
    ).resolves.toEqual([{ model: unresolved, status: 'unknown' }])
    expect(mockModelStore.loadModelFolders).toHaveBeenCalledOnce()
    expect(mockModelStore.getLoadedModelFolder).toHaveBeenCalledExactlyOnceWith(
      'checkpoints'
    )
  })

  it('uses an incomplete known snapshot when inventory loading fails', async () => {
    const installed = model('known.safetensors')
    const unresolved = model('unresolved.safetensors')
    mockModelStore.models = [
      {
        directory: installed.directory,
        normalized_file_name: installed.name
      }
    ]
    mockModelStore.modelFolders = [
      { directory: 'checkpoints', state: ResourceState.Uninitialized }
    ]
    const inventoryError = new Error('Inventory unavailable')
    mockModelStore.loadModels.mockRejectedValueOnce(inventoryError)
    mockModelStore.getLoadedModelFolder.mockRejectedValueOnce(inventoryError)

    await expect(
      useTemplateModelAvailability().resolveAvailability([
        installed,
        unresolved
      ])
    ).resolves.toEqual([
      { model: installed, status: 'installed' },
      { model: unresolved, status: 'unknown' }
    ])
    expect(mocks.reportError).toHaveBeenCalledExactlyOnceWith(inventoryError, {
      errorType: 'workflow_template_model_inventory_failed',
      level: 'warning'
    })
  })

  it('keeps absence unknown while a model folder is still loading', async () => {
    const unresolved = model('unresolved.safetensors')
    mockModelStore.modelFolders = [
      { directory: 'checkpoints', state: ResourceState.Loading }
    ]

    await expect(
      useTemplateModelAvailability().resolveAvailability([unresolved])
    ).resolves.toEqual([{ model: unresolved, status: 'unknown' }])
  })
})
