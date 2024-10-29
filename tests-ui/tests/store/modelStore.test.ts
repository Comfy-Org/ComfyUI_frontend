import { setActivePinia, createPinia } from 'pinia'
import { useModelStore } from '@/stores/modelStore'
import { api } from '@/scripts/api'

// Mock the api
jest.mock('@/scripts/api', () => ({
  api: {
    getModels: jest.fn(),
    getModelFolders: jest.fn(),
    viewMetadata: jest.fn()
  }
}))

function enableMocks() {
  ;(api.getModels as jest.Mock).mockResolvedValue([
    'sdxl.safetensors',
    'sdv15.safetensors',
    'noinfo.safetensors'
  ])
  ;(api.getModelFolders as jest.Mock).mockResolvedValue(['checkpoints', 'vae'])
  ;(api.viewMetadata as jest.Mock).mockImplementation((_, model) => {
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
    const model = folderStore.models['sdxl.safetensors']
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
    const model = folderStore.models['noinfo.safetensors']
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
    await store.getLoadedModelFolder('checkpoints')
    await store.getLoadedModelFolder('checkpoints')
    expect(api.getModels).toHaveBeenCalledTimes(1)
  })
})
