import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  ComfyModelDef,
  ModelFolder,
  ResourceState,
  useModelStore
} from '@/stores/modelStore'

const mocks = vi.hoisted(() => ({ reportError: vi.fn() }))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mocks.reportError
}))

import { useTemplateModelAvailability } from './useTemplateModelAvailability'

function model(name: string, directory = 'checkpoints'): ModelFile {
  return {
    name,
    directory,
    url: `https://example.com/${name}`
  }
}

function folder(directory: string, state: ResourceState): ModelFolder {
  const modelFolder = new ModelFolder(directory, async () => [])
  modelFolder.state = state
  return modelFolder
}

type TestingModelStore = Omit<
  ReturnType<typeof useModelStore>,
  'modelFolders' | 'models'
> & {
  modelFolders: ModelFolder[]
  models: ComfyModelDef[]
}

describe('useTemplateModelAvailability', () => {
  let modelStore: TestingModelStore

  beforeEach(() => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn }))
    // createTestingPinia makes readonly store getters writable for fixtures.
    modelStore = useModelStore() as TestingModelStore
    modelStore.modelFolders = []
    modelStore.models = []
    vi.mocked(modelStore.loadModels).mockResolvedValue([])
    vi.mocked(modelStore.loadModelFolders).mockResolvedValue(true)
    vi.mocked(modelStore.getLoadedModelFolder).mockImplementation(
      async (directory) =>
        modelStore.modelFolders.find(
          (folder) => folder.directory === directory
        ) ?? null
    )
  })

  it('loads only referenced directories before classifying a complete snapshot', async () => {
    const installed = model('installed.safetensors')
    const missing = model('missing.safetensors')
    modelStore.modelFolders = [
      folder('checkpoints', ResourceState.Loaded),
      folder('controlnet', ResourceState.Loaded)
    ]
    modelStore.models = [
      new ComfyModelDef(installed.name, installed.directory, 0)
    ]

    await expect(
      useTemplateModelAvailability().resolveAvailability([installed, missing])
    ).resolves.toEqual([
      { model: installed, status: 'installed' },
      { model: missing, status: 'missing' }
    ])
    expect(modelStore.getLoadedModelFolder).toHaveBeenCalledExactlyOnceWith(
      'checkpoints'
    )
    expect(modelStore.loadModelFolders).not.toHaveBeenCalled()
    expect(modelStore.loadModels).not.toHaveBeenCalled()
  })

  it('keeps absence unknown when the model-folder registry is empty', async () => {
    const unresolved = model('unresolved.safetensors')

    await expect(
      useTemplateModelAvailability().resolveAvailability([unresolved])
    ).resolves.toEqual([{ model: unresolved, status: 'unknown' }])
    expect(modelStore.loadModelFolders).toHaveBeenCalledOnce()
    expect(modelStore.getLoadedModelFolder).toHaveBeenCalledExactlyOnceWith(
      'checkpoints'
    )
  })

  it('uses an incomplete known snapshot when inventory loading fails', async () => {
    const installed = model('known.safetensors')
    const unresolved = model('unresolved.safetensors')
    modelStore.models = [
      new ComfyModelDef(installed.name, installed.directory, 0)
    ]
    modelStore.modelFolders = [
      folder('checkpoints', ResourceState.Uninitialized)
    ]
    const inventoryError = new Error('Inventory unavailable')
    vi.mocked(modelStore.getLoadedModelFolder).mockRejectedValueOnce(
      inventoryError
    )

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
    modelStore.modelFolders = [folder('checkpoints', ResourceState.Loading)]

    await expect(
      useTemplateModelAvailability().resolveAvailability([unresolved])
    ).resolves.toEqual([{ model: unresolved, status: 'unknown' }])
  })
})
