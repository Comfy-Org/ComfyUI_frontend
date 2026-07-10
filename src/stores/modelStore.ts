import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ModelFile } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

/** (Internal helper) finds a value in a metadata object from any of a list of keys. */
function _findInMetadata(
  metadata: Record<string, string | null>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    if (key in metadata) {
      const value = metadata[key]
      return value || null
    }
    for (const k in metadata) {
      if (k.endsWith(key)) {
        const value = metadata[k]
        return value || null
      }
    }
  }
  return null
}

/** Defines and holds metadata for a model */
export class ComfyModelDef {
  /** Path to the model */
  readonly path_index: number
  /** Proper filename of the model */
  readonly file_name: string
  /** Normalized filename of the model, with all backslashes replaced with forward slashes */
  readonly normalized_file_name: string
  /** Directory containing the model, eg 'checkpoints' */
  readonly directory: string
  /** Simplified copy of name, used as a default title. Excludes the directory and the '.safetensors' file extension */
  readonly simplified_file_name: string
  /** Key for the model, used to uniquely identify the model. */
  readonly key: string
  /** Title / display name of the model, sometimes same as the name but not always */
  title: string
  /** Metadata: architecture ID for the model, such as 'stable-diffusion-xl-v1-base' */
  architecture_id: string = ''
  /** Metadata: author of the model */
  author: string = ''
  /** Metadata: resolution of the model, eg '1024x1024' */
  resolution: string = ''
  /** Metadata: description of the model */
  description: string = ''
  /** Metadata: usage hint for the model */
  usage_hint: string = ''
  /** Metadata: trigger phrase for the model */
  trigger_phrase: string = ''
  /** Metadata: tags list for the model */
  tags: string[] = []
  /** Metadata: image for the model */
  image: string = ''
  /** Whether the model metadata has been loaded from the server, used for `load()` */
  has_loaded_metadata: boolean = false
  /** If true, a metadata load request has been triggered, but may or may not yet have finished loading */
  is_load_requested: boolean = false
  /** A string full of auto-computed lowercase-only searchable text for this model */
  searchable: string = ''

  constructor(name: string, directory: string, pathIndex: number) {
    this.path_index = pathIndex
    this.file_name = name
    this.normalized_file_name = name.replaceAll('\\', '/')
    this.simplified_file_name = this.normalized_file_name.split('/').pop() ?? ''
    if (this.simplified_file_name.endsWith('.safetensors')) {
      this.simplified_file_name = this.simplified_file_name.slice(
        0,
        -'.safetensors'.length
      )
    }
    this.title = this.simplified_file_name
    this.directory = directory
    this.key = `${directory}/${this.normalized_file_name}`
    this.updateSearchable()
  }

  updateSearchable() {
    this.searchable = [
      this.file_name,
      this.title,
      this.author,
      this.description,
      this.trigger_phrase,
      this.tags.join(', ')
    ]
      .join('\n')
      .toLowerCase()
  }

  /** Loads the model metadata from the server, filling in this object if data is available */
  async load(): Promise<void> {
    if (this.has_loaded_metadata || this.is_load_requested) {
      return
    }
    // viewMetadata reads the safetensors header off local disk; on Cloud the
    // model bytes live in object storage so there is nothing to read.
    if (isCloud) {
      return
    }
    this.is_load_requested = true
    try {
      const metadata = await api.viewMetadata(this.directory, this.file_name)
      if (!metadata) {
        return
      }
      this.title =
        _findInMetadata(
          metadata,
          'modelspec.title',
          'title',
          'display_name',
          'name'
        ) || this.title
      this.architecture_id =
        _findInMetadata(metadata, 'modelspec.architecture', 'architecture') ||
        ''
      this.author =
        _findInMetadata(metadata, 'modelspec.author', 'author') || ''
      this.description =
        _findInMetadata(metadata, 'modelspec.description', 'description') || ''
      this.resolution =
        _findInMetadata(metadata, 'modelspec.resolution', 'resolution') || ''
      this.usage_hint =
        _findInMetadata(metadata, 'modelspec.usage_hint', 'usage_hint') || ''
      this.trigger_phrase =
        _findInMetadata(
          metadata,
          'modelspec.trigger_phrase',
          'trigger_phrase'
        ) || ''
      this.image =
        _findInMetadata(
          metadata,
          'modelspec.thumbnail',
          'thumbnail',
          'image',
          'icon'
        ) || ''
      const tagsCommaSeparated =
        _findInMetadata(metadata, 'modelspec.tags', 'tags') || ''
      this.tags = tagsCommaSeparated.split(',').map((tag) => tag.trim())
      this.has_loaded_metadata = true
      this.updateSearchable()
    } catch (error) {
      console.error('Error loading model metadata', this.file_name, this, error)
    }
  }
}

export enum ResourceState {
  Uninitialized,
  Loading,
  Loaded
}

/**
 * Resolves the preview image for a model: embedded metadata thumbnail when
 * loaded, otherwise the server-rendered `.webp` preview. The preview endpoint
 * reads a rendered thumbnail off local disk, which is unavailable on Cloud
 * (model bytes live in object storage), so Cloud resolves to no preview.
 */
export function getModelPreviewUrl(model: ComfyModelDef): string {
  if (model.image) return model.image
  if (isCloud) return ''
  const extension = model.file_name.split('.').pop()
  const filename = model.file_name.replace(`.${extension}`, '.webp')
  const encodedFilename = encodeURIComponent(filename).replace(/%2F/g, '/')
  return `/api/experiment/models/preview/${model.directory}/${model.path_index}/${encodedFilename}`
}

/**
 * FE-owned copy of core's default `supported_pt_extensions`, applied to
 * match-all folders (empty registered allowlist) so they don't surface
 * README/config noise. Accepted to go stale across core version bumps; the
 * whole surface is expected to be short-lived.
 */
const DEFAULT_MODEL_EXTENSIONS = [
  '.ckpt',
  '.pt',
  '.pt2',
  '.bin',
  '.pth',
  '.safetensors',
  '.pkl',
  '.sft'
]

/**
 * Resolves a folder's display allowlist from its raw registered `extensions`
 * (`/experiment/models`): non-empty is used verbatim; an empty array
 * (match-all) or an absent field (older backends) takes the FE default list,
 * reproducing the legacy sidebar's global-set behavior so nothing that used
 * to be hidden starts showing.
 */
export function effectiveModelExtensions(
  extensions: string[] | undefined
): string[] {
  return extensions?.length ? extensions : DEFAULT_MODEL_EXTENSIONS
}

/**
 * Whether a model file belongs in a folder given its display allowlist. An
 * empty list, or a list with no real (`.`-prefixed) extensions (the
 * `'folder'`/`''` sentinels), leaves the folder unfiltered.
 */
export function matchesModelExtension(
  fileName: string,
  extensions: string[]
): boolean {
  const realExtensions = extensions.filter((ext) => ext.startsWith('.'))
  if (realExtensions.length === 0) return true
  const lower = fileName.toLowerCase()
  return realExtensions.some((ext) => lower.endsWith(ext.toLowerCase()))
}

export class ModelFolder {
  /** Models in this folder */
  models: Record<string, ComfyModelDef> = {}
  state: ResourceState = ResourceState.Uninitialized

  constructor(
    public directory: string,
    private getModelsFunc: (folder: string) => Promise<ModelFile[]>,
    public readonly extensions: string[] = []
  ) {}

  get key(): string {
    return this.directory + '/'
  }

  /**
   * Loads the models in this folder from the server
   */
  async load() {
    if (this.state !== ResourceState.Uninitialized) {
      return this
    }
    this.state = ResourceState.Loading
    const models = await this.getModelsFunc(this.directory)
    for (const model of models) {
      if (!matchesModelExtension(model.name, this.extensions)) continue
      this.models[`${model.pathIndex}/${model.name}`] = new ComfyModelDef(
        model.name,
        this.directory,
        model.pathIndex
      )
    }
    this.state = ResourceState.Loaded
    return this
  }
}

/** Model store handler, wraps individual per-folder model stores */
export const useModelStore = defineStore('models', () => {
  const settingStore = useSettingStore()
  const modelFolderNames = ref<string[]>([])
  const modelFolderByName = ref<Record<string, ModelFolder>>({})
  const modelFolders = computed<ModelFolder[]>(() =>
    modelFolderNames.value.map(
      (folderName) => modelFolderByName.value[folderName]
    )
  )
  const models = computed<ComfyModelDef[]>(() =>
    modelFolders.value.flatMap((folder) => Object.values(folder.models))
  )

  function createGetModelsFunc(): (folder: string) => Promise<ModelFile[]> {
    const useAssetAPI: boolean = settingStore.get('Comfy.Assets.UseAssetAPI')
    return useAssetAPI
      ? (folder) => assetService.getAssetModels(folder)
      : (folder) => api.getModels(folder)
  }

  let modelFoldersRequestId = 0

  /**
   * Loads the model folders from the server.
   *
   * The folder list (and its registration order) always comes from
   * `/experiment/models`, the source of truth for which model folders exist;
   * only the per-folder contents differ between the asset API and legacy paths.
   * Concurrent loads (manual refresh racing the scan-complete reload) commit
   * only the newest request so a slow stale response cannot overwrite a
   * fresher folder structure.
   */
  async function loadModelFolders() {
    const requestId = ++modelFoldersRequestId
    const resData = await api.getModelFolders()
    if (requestId !== modelFoldersRequestId) return
    modelFolderNames.value = resData.map((folder) => folder.name)
    modelFolderByName.value = {}
    const useAssetAPI: boolean = settingStore.get('Comfy.Assets.UseAssetAPI')
    const getModelsFunc = createGetModelsFunc()
    for (const folder of resData) {
      modelFolderByName.value[folder.name] = new ModelFolder(
        folder.name,
        getModelsFunc,
        // Display filtering applies to the asset walk only; the legacy
        // listing keeps its historical server-side (global-set) filtering.
        useAssetAPI ? effectiveModelExtensions(folder.extensions) : []
      )
    }
  }

  async function getLoadedModelFolder(
    folderName: string
  ): Promise<ModelFolder | null> {
    const folder = modelFolderByName.value[folderName]
    return folder ? await folder.load() : null
  }

  /**
   * Loads all model folders' contents from the server
   */
  async function loadModels() {
    return Promise.all(modelFolders.value.map((folder) => folder.load()))
  }

  /**
   * Discards the cache for a single folder and re-loads its contents.
   * Use when on-disk contents of that folder have changed (e.g. after upload).
   * Falls back to refreshing the whole library when the folder is unknown so
   * a newly-introduced folder type is picked up without dropping other
   * folders' loaded contents.
   */
  async function refreshModelFolder(folderName: string) {
    assetService.invalidateModelBuckets()
    if (!(folderName in modelFolderByName.value)) {
      await refresh()
      return
    }
    const folder = new ModelFolder(
      folderName,
      createGetModelsFunc(),
      modelFolderByName.value[folderName].extensions
    )
    await folder.load()
    modelFolderByName.value[folderName] = folder
  }

  /**
   * Re-fetches the folder structure and re-loads any folder whose contents
   * had previously been loaded, picking up server-side changes without
   * losing the currently-visible contents.
   */
  async function reloadModels() {
    assetService.invalidateModelBuckets()
    const previouslyLoaded = modelFolders.value
      .filter((folder) => folder.state === ResourceState.Loaded)
      .map((folder) => folder.directory)
    await loadModelFolders()
    await Promise.all(
      previouslyLoaded
        .filter((name) => name in modelFolderByName.value)
        .map((name) => modelFolderByName.value[name].load())
    )
  }

  /**
   * Asks the backend to rescan the model roots so files added on disk since
   * startup become assets. Skipped on Cloud (models are ingested via uploads,
   * not scanned from disk) and on the legacy listing path (which reads the
   * filesystem live on every request).
   */
  function requestModelScan() {
    if (isCloud) return
    if (!settingStore.get('Comfy.Assets.UseAssetAPI')) return
    void assetService.seedModelAssets().catch((error) => {
      console.warn('Unable to start model asset scan', error)
    })
  }

  /**
   * Manual refresh ("r" key, sidebar refresh button): kicks off a backend
   * rescan and immediately re-loads the currently known server state. When
   * the scan's fast phase completes, `assets.seed.fast_complete` re-loads
   * again with whatever the scan discovered.
   */
  async function refresh() {
    requestModelScan()
    await reloadModels()
  }

  api.addCustomEventListener('assets.seed.fast_complete', async () => {
    try {
      await reloadModels()
    } catch (error) {
      console.error('Failed to reload the model library after a scan', error)
    }
  })

  return {
    models,
    modelFolders,
    loadModelFolders,
    loadModels,
    getLoadedModelFolder,
    refreshModelFolder,
    refresh
  }
})
