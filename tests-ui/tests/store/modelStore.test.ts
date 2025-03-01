import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { useModelStore } from '@/stores/modelStore'

// Mock the api
vi.mock('@/scripts/api', () => ({
  api: {
    getModels: vi.fn(),
    getModelFolders: vi.fn(),
    viewMetadata: vi.fn()
  }
}))

function enableMocks() {
  vi.mocked(api.getModels).mockResolvedValue([
    { name: 'sdxl.safetensors', pathIndex: 0 },
    { name: 'sdv15.safetensors', pathIndex: 0 },
    { name: 'noinfo.safetensors', pathIndex: 0 }
  ])
  vi.mocked(api.getModelFolders).mockResolvedValue([
    { name: 'checkpoints', folders: ['/path/to/checkpoints'] },
    { name: 'vae', folders: ['/path/to/vae'] }
  ])
  vi.mocked(api.viewMetadata).mockImplementation((_, model) => {
    if (model === 'noinfo.safetensors') {
      return Promise.resolve({})
    }
    return Promise.resolve({
      'modelspec.title': `Title of ${model}`,
      display_name: 'Should not show',
      'modelspec.architecture': 'stable-diffusion-xl-base-v1',
      'modelspec.author': `Author of ${model}`,
      'modelspec.description': `Description of ${model}`,
      'modelspec.resolution': '1024x1024',
      trigger_phrase: `Trigger phrase of ${model}`,
      usage_hint: `Usage hint of ${model}`,
      tags: `tags,for,${model}`
    })
  })
}

describe('useModelStore', () => {
  let store: ReturnType<typeof useModelStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    store = useModelStore()
    vi.resetAllMocks()
  })

  it('should load models', async () => {
    enableMocks()
    await store.loadModelFolders()
    const folderStore = await store.getLoadedModelFolder('checkpoints')
    expect(folderStore).not.toBeNull()
    if (!folderStore) return
    expect(Object.keys(folderStore.models).length).toBe(3)
  })

  it('should load model metadata', async () => {
    enableMocks()
    await store.loadModelFolders()
    const folderStore = await store.getLoadedModelFolder('checkpoints')
    expect(folderStore).not.toBeNull()
    if (!folderStore) return
    const model = folderStore.models['0/sdxl.safetensors']
    await model.load()
    expect(model.title).toBe('Title of sdxl.safetensors')
    expect(model.architecture_id).toBe('stable-diffusion-xl-base-v1')
    expect(model.author).toBe('Author of sdxl.safetensors')
    expect(model.description).toBe('Description of sdxl.safetensors')
    expect(model.resolution).toBe('1024x1024')
    expect(model.trigger_phrase).toBe('Trigger phrase of sdxl.safetensors')
    expect(model.usage_hint).toBe('Usage hint of sdxl.safetensors')
    expect(model.tags).toHaveLength(3)
  })

  it('should handle no metadata', async () => {
    enableMocks()
    await store.loadModelFolders()
    const folderStore = await store.getLoadedModelFolder('checkpoints')
    expect(folderStore).not.toBeNull()
    if (!folderStore) return
    const model = folderStore.models['0/noinfo.safetensors']
    await model.load()
    expect(model.file_name).toBe('noinfo.safetensors')
    expect(model.title).toBe('noinfo')
    expect(model.architecture_id).toBe('')
    expect(model.author).toBe('')
    expect(model.description).toBe('')
    expect(model.resolution).toBe('')
  })

  it('should cache model information', async () => {
    enableMocks()
    await store.loadModelFolders()
    expect(api.getModels).toHaveBeenCalledTimes(0)
    await store.getLoadedModelFolder('checkpoints')
    expect(api.getModels).toHaveBeenCalledTimes(1)
    await store.getLoadedModelFolder('checkpoints')
    expect(api.getModels).toHaveBeenCalledTimes(1)
  })
})
