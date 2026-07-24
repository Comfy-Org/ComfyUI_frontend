import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { assetService } from '@/platform/assets/services/assetService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import {
  ResourceState,
  effectiveModelExtensions,
  getModelPreviewUrl,
  matchesModelExtension,
  useModelStore
} from '@/stores/modelStore'

const { isCloudRef } = vi.hoisted(() => ({ isCloudRef: { value: false } }))

vi.mock('@/platform/distribution/types', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get isCloud() {
    return isCloudRef.value
  }
}))

// Mock the api
vi.mock('@/scripts/api', () => ({
  api: {
    getModels: vi.fn(),
    getModelFolders: vi.fn(),
    viewMetadata: vi.fn(),
    apiURL: vi.fn((path: string) => `http://localhost:8188${path}`),
    addEventListener: vi.fn(),
    addCustomEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

// Mock the assetService
vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetModels: vi.fn(),
    invalidateModelBuckets: vi.fn(),
    onModelsScanned: vi.fn(),
    seedModelAssets: vi.fn()
  }
}))

// Mock the settingStore
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn()
}))

function enableMocks(useAssetAPI = false) {
  // Mock settingStore to return the useAssetAPI setting
  const mockSettingStore = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'Comfy.Assets.UseAssetAPI') {
        return useAssetAPI
      }
      return false
    })
  }
  vi.mocked(useSettingStore, { partial: true }).mockReturnValue(
    mockSettingStore
  )

  // Mock experimental API - returns objects with name and folders properties
  vi.mocked(api.getModels).mockResolvedValue([
    { name: 'sdxl.safetensors', pathIndex: 0 },
    { name: 'sdv15.safetensors', pathIndex: 0 },
    { name: 'noinfo.safetensors', pathIndex: 0 }
  ])
  vi.mocked(api.getModelFolders).mockResolvedValue([
    { name: 'checkpoints', folders: ['/path/to/checkpoints'] },
    { name: 'vae', folders: ['/path/to/vae'] }
  ])

  // Asset API supplies only the per-folder model contents; folders come from
  // api.getModelFolders in both paths.
  vi.mocked(assetService.getAssetModels).mockResolvedValue([
    { name: 'sdxl.safetensors', pathIndex: 0 },
    { name: 'sdv15.safetensors', pathIndex: 0 },
    { name: 'noinfo.safetensors', pathIndex: 0 }
  ])
  vi.mocked(assetService.seedModelAssets).mockResolvedValue(undefined)
  vi.mocked(assetService.onModelsScanned).mockReturnValue(() => {})

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
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    isCloudRef.value = false
  })

  it('should load models', async () => {
    enableMocks()
    store = useModelStore()
    await store.loadModelFolders()
    const folderStore = await store.getLoadedModelFolder('checkpoints')
    expect(folderStore).toBeDefined()
    expect(Object.keys(folderStore!.models)).toHaveLength(3)
  })

  it('should load model metadata', async () => {
    enableMocks()
    store = useModelStore()
    await store.loadModelFolders()
    const folderStore = await store.getLoadedModelFolder('checkpoints')
    expect(folderStore).toBeDefined()
    const model = folderStore!.models['0/sdxl.safetensors']
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
    store = useModelStore()
    await store.loadModelFolders()
    const folderStore = await store.getLoadedModelFolder('checkpoints')
    expect(folderStore).toBeDefined()
    const model = folderStore!.models['0/noinfo.safetensors']
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
    store = useModelStore()
    await store.loadModelFolders()
    expect(api.getModels).toHaveBeenCalledTimes(0)
    await store.getLoadedModelFolder('checkpoints')
    expect(api.getModels).toHaveBeenCalledTimes(1)
    await store.getLoadedModelFolder('checkpoints')
    expect(api.getModels).toHaveBeenCalledTimes(1)
  })

  describe('refreshModelFolder', () => {
    it('re-fetches the contents of a previously loaded folder', async () => {
      enableMocks()
      store = useModelStore()
      await store.loadModelFolders()
      await store.getLoadedModelFolder('checkpoints')
      expect(api.getModels).toHaveBeenCalledTimes(1)

      vi.mocked(api.getModels).mockResolvedValueOnce([
        { name: 'sdxl.safetensors', pathIndex: 0 },
        { name: 'sdv15.safetensors', pathIndex: 0 },
        { name: 'noinfo.safetensors', pathIndex: 0 },
        { name: 'new-upload.safetensors', pathIndex: 0 }
      ])

      await store.refreshModelFolder('checkpoints')

      expect(api.getModels).toHaveBeenCalledTimes(2)
      const folder = await store.getLoadedModelFolder('checkpoints')
      expect(Object.keys(folder!.models)).toHaveLength(4)
      expect(folder!.models['0/new-upload.safetensors']).toBeDefined()
    })

    it('falls back to refreshing folder structure when folder is unknown', async () => {
      enableMocks()
      store = useModelStore()
      await store.loadModelFolders()
      expect(api.getModelFolders).toHaveBeenCalledTimes(1)

      await store.refreshModelFolder('loras')

      expect(api.getModelFolders).toHaveBeenCalledTimes(2)
      expect(api.getModels).not.toHaveBeenCalled()
    })
  })

  describe('refresh', () => {
    it('re-loads only folders that were previously loaded', async () => {
      enableMocks()
      store = useModelStore()
      await store.loadModelFolders()
      await store.getLoadedModelFolder('checkpoints')
      expect(api.getModels).toHaveBeenCalledTimes(1)

      await store.refresh()

      expect(api.getModelFolders).toHaveBeenCalledTimes(2)
      expect(api.getModels).toHaveBeenCalledTimes(2)
      expect(api.getModels).toHaveBeenLastCalledWith('checkpoints')
    })

    it('does not load folders that were never opened', async () => {
      enableMocks()
      store = useModelStore()
      await store.loadModelFolders()

      await store.refresh()

      expect(api.getModelFolders).toHaveBeenCalledTimes(2)
      expect(api.getModels).not.toHaveBeenCalled()
    })

    it('kicks off a backend scan when models come from the asset API', async () => {
      enableMocks(true)
      store = useModelStore()

      await store.refresh()

      expect(assetService.seedModelAssets).toHaveBeenCalledTimes(1)
    })

    it('does not scan on the legacy listing path', async () => {
      enableMocks(false)
      store = useModelStore()

      await store.refresh()

      expect(assetService.seedModelAssets).not.toHaveBeenCalled()
    })
  })

  describe('concurrent folder loads', () => {
    it('does not let a stale folder response overwrite a fresher one', async () => {
      enableMocks()
      let resolveStale!: (value: { name: string; folders: string[] }[]) => void
      vi.mocked(api.getModelFolders).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStale = resolve
        })
      )
      store = useModelStore()
      const staleLoad = store.loadModelFolders()

      vi.mocked(api.getModelFolders).mockResolvedValueOnce([
        { name: 'fresh-folder', folders: ['/fresh'] }
      ])
      await store.loadModelFolders()
      expect(store.modelFolders.map((f) => f.directory)).toEqual([
        'fresh-folder'
      ])

      resolveStale([{ name: 'stale-folder', folders: ['/stale'] }])
      await staleLoad

      expect(store.modelFolders.map((f) => f.directory)).toEqual([
        'fresh-folder'
      ])
    })
  })

  it('retries the folder load when a concurrent newer load superseded it', async () => {
    enableMocks()
    store = useModelStore()

    // First structure load is superseded before it resolves; the retry commits.
    let resolveSuperseded!: (
      value: { name: string; folders: string[] }[]
    ) => void
    vi.mocked(api.getModelFolders).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSuperseded = resolve
      })
    )
    const eagerLoad = store.loadModels()
    const supersedingLoad = store.loadModelFolders()
    resolveSuperseded([{ name: 'checkpoints', folders: ['/p'] }])

    await Promise.all([eagerLoad, supersedingLoad])

    expect(store.models.length).toBeGreaterThan(0)
  })

  it('allows a folder to retry loading after a transient failure', async () => {
    enableMocks()
    vi.mocked(api.getModels).mockRejectedValueOnce(new Error('transient'))
    store = useModelStore()
    await store.loadModelFolders()

    const failing = store.modelFolders.find(
      (f) => f.directory === 'checkpoints'
    )!
    await expect(failing.load()).rejects.toThrow('transient')
    expect(failing.state).toBe(ResourceState.Uninitialized)

    const folder = await store.getLoadedModelFolder('checkpoints')
    expect(Object.keys(folder!.models)).toHaveLength(3)
  })

  it('eager-loading before boot loads the folder structure first', async () => {
    enableMocks()
    store = useModelStore()

    await store.loadModels()

    expect(api.getModelFolders).toHaveBeenCalledTimes(1)
    expect(api.getModels).toHaveBeenCalledWith('checkpoints')
    expect(api.getModels).toHaveBeenCalledWith('vae')
  })

  describe('refreshModelFolder races', () => {
    it('keeps the newer refresh when an older one for the same folder finishes last', async () => {
      enableMocks()
      store = useModelStore()
      await store.loadModelFolders()
      await store.getLoadedModelFolder('checkpoints')

      let resolveOld!: (value: { name: string; pathIndex: number }[]) => void
      vi.mocked(api.getModels).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        })
      )
      const oldRefresh = store.refreshModelFolder('checkpoints')

      vi.mocked(api.getModels).mockResolvedValueOnce([
        { name: 'newer.safetensors', pathIndex: 0 }
      ])
      await store.refreshModelFolder('checkpoints')

      resolveOld([{ name: 'older.safetensors', pathIndex: 0 }])
      await oldRefresh

      const folder = await store.getLoadedModelFolder('checkpoints')
      expect(folder!.models['0/newer.safetensors']).toBeDefined()
      expect(folder!.models['0/older.safetensors']).toBeUndefined()
    })

    it('discards a refresh that raced a structure rebuild started earlier', async () => {
      enableMocks()
      store = useModelStore()
      await store.loadModelFolders()
      await store.getLoadedModelFolder('checkpoints')

      // The rebuild starts (and bumps the request id) BEFORE the refresh
      // snapshots it, so an id check alone cannot catch this interleaving.
      let resolveRebuild!: (
        value: { name: string; folders: string[] }[]
      ) => void
      vi.mocked(api.getModelFolders).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRebuild = resolve
        })
      )
      const rebuild = store.loadModelFolders()

      let resolveContents!: (
        value: { name: string; pathIndex: number }[]
      ) => void
      vi.mocked(api.getModels).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveContents = resolve
        })
      )
      const refresh = store.refreshModelFolder('checkpoints')

      resolveRebuild([{ name: 'checkpoints', folders: ['/p'] }])
      await rebuild
      resolveContents([{ name: 'stale.safetensors', pathIndex: 0 }])
      await refresh

      const entry = store.modelFolders.find(
        (f) => f.directory === 'checkpoints'
      )!
      expect(entry.state).toBe(ResourceState.Uninitialized)
    })

    it('does not resurrect a stale folder over a fresher structure', async () => {
      enableMocks()
      store = useModelStore()
      await store.loadModelFolders()
      await store.getLoadedModelFolder('checkpoints')

      let resolveStaleContents!: (
        value: { name: string; pathIndex: number }[]
      ) => void
      vi.mocked(api.getModels).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStaleContents = resolve
        })
      )
      const staleRefresh = store.refreshModelFolder('checkpoints')

      // A full reload rebuilds the folder structure mid-refresh.
      await store.loadModelFolders()
      const freshFolder = await store.getLoadedModelFolder('checkpoints')

      resolveStaleContents([{ name: 'stale.safetensors', pathIndex: 0 }])
      await staleRefresh

      const current = await store.getLoadedModelFolder('checkpoints')
      expect(current).toBe(freshFolder)
      expect(current!.models['0/stale.safetensors']).toBeUndefined()
    })
  })

  describe('scan fast-phase completion', () => {
    it('re-loads folders whose eager load was still in flight when the reload fired', async () => {
      enableMocks(true)
      store = useModelStore()
      await store.loadModelFolders()

      // Eager load starts but its fetch never lands before the scan event.
      let resolveEager!: (value: { name: string; pathIndex: number }[]) => void
      vi.mocked(assetService.getAssetModels).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveEager = resolve
        })
      )
      const eagerLoad = store.getLoadedModelFolder('checkpoints')

      const scanCallback = vi.mocked(assetService.onModelsScanned).mock
        .calls[0]?.[0]
      await scanCallback!()

      // The rebuilt folder must have been re-loaded, not left uninitialized
      // while the original request finishes into a detached folder object.
      const folder = store.modelFolders.find(
        (f) => f.directory === 'checkpoints'
      )
      expect(folder!.state).toBe(ResourceState.Loaded)

      resolveEager([{ name: 'detached.safetensors', pathIndex: 0 }])
      await eagerLoad
      const current = await store.getLoadedModelFolder('checkpoints')
      expect(current!.models['0/detached.safetensors']).toBeUndefined()
    })

    it('re-loads previously loaded folders when the event fires', async () => {
      enableMocks(true)
      store = useModelStore()
      await store.loadModelFolders()
      await store.getLoadedModelFolder('checkpoints')
      expect(assetService.getAssetModels).toHaveBeenCalledTimes(1)

      const scanCallback = vi.mocked(assetService.onModelsScanned).mock
        .calls[0]?.[0]
      expect(scanCallback).toBeDefined()
      await scanCallback!()
      await vi.waitFor(() => {
        expect(assetService.getAssetModels).toHaveBeenCalledTimes(2)
      })

      expect(assetService.invalidateModelBuckets).toHaveBeenCalled()
      expect(assetService.seedModelAssets).not.toHaveBeenCalled()
    })

    it('logs instead of rejecting when the post-scan reload fails', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      enableMocks(true)
      vi.mocked(api.getModelFolders).mockRejectedValue(
        new Error('transient network failure')
      )
      store = useModelStore()
      const scanCallback = vi.mocked(assetService.onModelsScanned).mock
        .calls[0]?.[0]

      await scanCallback!()
      await vi.waitFor(() => {
        expect(error).toHaveBeenCalledWith(
          expect.stringContaining('reload'),
          expect.any(Error)
        )
      })
      error.mockRestore()
    })
  })

  describe('visibleModelFolders', () => {
    it('hides folders that loaded empty in asset mode', async () => {
      enableMocks(true)
      vi.mocked(assetService.getAssetModels).mockImplementation(
        async (folder: string) =>
          folder === 'checkpoints'
            ? [{ name: 'sdxl.safetensors', pathIndex: 0 }]
            : []
      )
      store = useModelStore()
      await store.loadModels()

      expect(store.visibleModelFolders.map((f) => f.directory)).toEqual([
        'checkpoints'
      ])
      // The full folder list is untouched for consumers that need it.
      expect(store.modelFolders).toHaveLength(2)
    })

    it('keeps all registered folders visible on the legacy path', async () => {
      enableMocks(false)
      vi.mocked(api.getModels).mockResolvedValue([])
      store = useModelStore()
      await store.loadModels()

      expect(store.visibleModelFolders).toHaveLength(2)
    })
  })

  describe('cloud gating', () => {
    beforeEach(() => {
      isCloudRef.value = true
    })

    it('does not read safetensors metadata from disk on cloud', async () => {
      enableMocks(true)
      store = useModelStore()
      await store.loadModelFolders()
      const folderStore = await store.getLoadedModelFolder('checkpoints')
      const model = folderStore!.models['0/sdxl.safetensors']

      await model.load()

      expect(api.viewMetadata).not.toHaveBeenCalled()
      expect(model.title).toBe('sdxl')
    })

    it('resolves no preview url on cloud', async () => {
      enableMocks(true)
      store = useModelStore()
      await store.loadModelFolders()
      const folderStore = await store.getLoadedModelFolder('checkpoints')
      const model = folderStore!.models['0/sdxl.safetensors']

      expect(getModelPreviewUrl(model)).toBe('')
    })

    it('does not trigger a disk scan on cloud', async () => {
      enableMocks(true)
      store = useModelStore()

      await store.refresh()

      expect(assetService.seedModelAssets).not.toHaveBeenCalled()
    })
  })

  describe('API switching functionality', () => {
    it('should use experimental API for complete workflow when UseAssetAPI setting is false', async () => {
      enableMocks(false) // useAssetAPI = false
      store = useModelStore()
      await store.loadModelFolders()
      const folderStore = await store.getLoadedModelFolder('checkpoints')

      // Folders come from /experiment/models; legacy path also serves models.
      expect(api.getModelFolders).toHaveBeenCalledTimes(1)
      expect(api.getModels).toHaveBeenCalledWith('checkpoints')
      expect(assetService.getAssetModels).toHaveBeenCalledTimes(0)
      expect(folderStore).toBeDefined()
      expect(Object.keys(folderStore!.models)).toHaveLength(3)
    })

    it('should use asset API for model contents but /experiment/models for folders when UseAssetAPI is true', async () => {
      enableMocks(true) // useAssetAPI = true
      store = useModelStore()
      await store.loadModelFolders()
      const folderStore = await store.getLoadedModelFolder('checkpoints')

      // Folders always come from /experiment/models; only contents use the asset API.
      expect(api.getModelFolders).toHaveBeenCalledTimes(1)
      expect(assetService.getAssetModels).toHaveBeenCalledWith('checkpoints')
      expect(api.getModels).toHaveBeenCalledTimes(0)
      expect(folderStore).toBeDefined()
      expect(Object.keys(folderStore!.models)).toHaveLength(3)
    })

    it('filters asset-path folder contents by the folder extensions', async () => {
      enableMocks(true)
      vi.mocked(api.getModelFolders).mockResolvedValue([
        { name: 'checkpoints', folders: ['/p'], extensions: ['.safetensors'] }
      ])
      vi.mocked(assetService.getAssetModels).mockResolvedValue([
        { name: 'keep.safetensors', pathIndex: 0 },
        { name: 'notes.txt', pathIndex: 0 }
      ])
      store = useModelStore()
      await store.loadModelFolders()
      const folder = await store.getLoadedModelFolder('checkpoints')

      const names = Object.values(folder!.models).map((m) => m.file_name)
      expect(names).toEqual(['keep.safetensors'])
    })

    it('hides non-model noise in match-all folders on the asset path', async () => {
      enableMocks(true)
      vi.mocked(api.getModelFolders).mockResolvedValue([
        { name: 'LLM', folders: ['/p'], extensions: [] }
      ])
      vi.mocked(assetService.getAssetModels).mockResolvedValue([
        { name: 'model.safetensors', pathIndex: 0 },
        { name: 'README.md', pathIndex: 0 }
      ])
      store = useModelStore()
      await store.loadModelFolders()
      const folder = await store.getLoadedModelFolder('LLM')

      const names = Object.values(folder!.models).map((m) => m.file_name)
      expect(names).toEqual(['model.safetensors'])
    })

    it('leaves the legacy listing unfiltered', async () => {
      enableMocks(false)
      vi.mocked(api.getModelFolders).mockResolvedValue([
        { name: 'checkpoints', folders: ['/p'], extensions: ['.safetensors'] }
      ])
      vi.mocked(api.getModels).mockResolvedValue([
        { name: 'keep.safetensors', pathIndex: 0 },
        { name: 'legacy-visible.gguf', pathIndex: 0 }
      ])
      store = useModelStore()
      await store.loadModelFolders()
      const folder = await store.getLoadedModelFolder('checkpoints')

      const names = Object.values(folder!.models).map((m) => m.file_name)
      expect(names).toEqual(['keep.safetensors', 'legacy-visible.gguf'])
    })
  })
})

describe(matchesModelExtension, () => {
  it('keeps files whose extension is in the folder list', () => {
    expect(
      matchesModelExtension('a.safetensors', ['.safetensors', '.ckpt'])
    ).toBe(true)
    expect(matchesModelExtension('a.txt', ['.safetensors'])).toBe(false)
  })

  it('matches case-insensitively and on subpaths', () => {
    expect(
      matchesModelExtension('sub/dir/A.SAFETENSORS', ['.safetensors'])
    ).toBe(true)
  })

  it('is permissive when there are no real extensions', () => {
    // Unfiltered folders (empty) and the `folder`/`''` sentinels show everything.
    expect(matchesModelExtension('readme.md', [])).toBe(true)
    expect(matchesModelExtension('anything', ['folder'])).toBe(true)
    expect(matchesModelExtension('anything', [''])).toBe(true)
  })
})

describe(effectiveModelExtensions, () => {
  it('uses a registered allowlist verbatim', () => {
    expect(effectiveModelExtensions(['.gguf'])).toEqual(['.gguf'])
  })

  it('substitutes the default list for match-all folders', () => {
    const effective = effectiveModelExtensions([])
    expect(effective).toContain('.safetensors')
    expect(matchesModelExtension('readme.md', effective)).toBe(false)
  })

  it('treats an absent field (older backends) like match-all', () => {
    expect(effectiveModelExtensions(undefined)).toEqual(
      effectiveModelExtensions([])
    )
  })

  it('treats a sentinel-only allowlist like match-all', () => {
    // The `'folder'`/`''` sentinels are not real extensions; both helpers
    // must agree these lists mean match-all so noise stays filtered.
    expect(effectiveModelExtensions(['folder'])).toEqual(
      effectiveModelExtensions([])
    )
    expect(effectiveModelExtensions([''])).toEqual(effectiveModelExtensions([]))
    expect(
      matchesModelExtension('readme.md', effectiveModelExtensions(['folder']))
    ).toBe(false)
  })
})
