import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useTemplateModelAvailability } from './useTemplateModelAvailability'

const ResourceState = {
  Uninitialized: 0,
  Loading: 1,
  Loaded: 2
} as const

const mockModelStore = vi.hoisted(() => ({
  loadModels: vi.fn<() => Promise<unknown[]>>(),
  modelFolders: [] as Array<{ state: number }>,
  models: [] as Array<{ directory: string; normalized_file_name: string }>
}))

vi.mock('@/stores/modelStore', () => ({
  ResourceState: { Uninitialized: 0, Loading: 1, Loaded: 2 },
  useModelStore: () => mockModelStore
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
  })

  it('classifies from the complete inventory loaded before resolution', async () => {
    const installed = model('installed.safetensors')
    const missing = model('missing.safetensors')
    mockModelStore.loadModels.mockImplementationOnce(async () => {
      mockModelStore.models = [
        {
          directory: installed.directory,
          normalized_file_name: installed.name
        }
      ]
      return []
    })

    await expect(
      useTemplateModelAvailability().resolveAvailability([installed, missing])
    ).resolves.toEqual([
      { model: installed, status: 'installed' },
      { model: missing, status: 'missing' }
    ])
    expect(mockModelStore.loadModels).toHaveBeenCalledOnce()
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
    mockModelStore.loadModels.mockRejectedValueOnce(
      new Error('Inventory unavailable')
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
  })

  it('keeps absence unknown while a model folder is still loading', async () => {
    const unresolved = model('unresolved.safetensors')
    mockModelStore.modelFolders = [{ state: ResourceState.Loading }]

    await expect(
      useTemplateModelAvailability().resolveAvailability([unresolved])
    ).resolves.toEqual([{ model: unresolved, status: 'unknown' }])
  })
})
