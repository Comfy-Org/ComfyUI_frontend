import { api } from '@/scripts/api'
import { defineStore } from 'pinia'

/** (Internal helper) finds a value in a metadata object from any of a list of keys. */
function _findInMetadata(metadata: any, ...keys: string[]): string | null {
  for (const key of keys) {
    if (key in metadata) {
      return metadata[key]
    }
    for (const k in metadata) {
      if (k.endsWith(key)) {
        return metadata[k]
      }
    }
  }
  return null
}

/** Defines and holds metadata for a model */
export class ComfyModelDef {
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
  /** If true, this is a fake model object used as a placeholder for something (eg a loading icon) */
  is_fake_object: boolean = false
  /** A string full of auto-computed lowercase-only searchable text for this model */
  searchable: string = ''

  constructor(name: string, directory: string) {
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

export class ModelFolder {
  models: Record<string, ComfyModelDef> = {}

  constructor(directory: string, models: string[]) {
    for (const model of models) {
      this.models[model] = new ComfyModelDef(model, directory)
    }
  }

  async loadModelMetadata(modelName: string) {
    if (this.models[modelName]) {
      await this.models[modelName].load()
    }
  }
}

const folderBlacklist = ['configs', 'custom_nodes']

/** Model store handler, wraps individual per-folder model stores */
export const useModelStore = defineStore('modelStore', {
  state: () => ({
    modelStoreMap: {} as Record<string, ModelFolder | null>,
    isLoading: {} as Record<string, Promise<ModelFolder | null> | null>,
    modelFolders: [] as string[]
  }),
  actions: {
    async getModelsInFolderCached(folder: string): Promise<ModelFolder | null> {
      if (folder in this.modelStoreMap) {
        return this.modelStoreMap[folder]
      }
      if (this.isLoading[folder]) {
        return this.isLoading[folder]
      }
      const promise = api.getModels(folder).then((models) => {
        if (!models) {
          return null
        }
        const store = new ModelFolder(folder, models)
        this.modelStoreMap[folder] = store
        this.isLoading[folder] = null
        return store
      })
      this.isLoading[folder] = promise
      return promise
    },
    clearCache() {
      this.modelStoreMap = {}
    },
    async getModelFolders() {
      this.modelFolders = (await api.getModelFolders()).filter(
        (folder) => !folderBlacklist.includes(folder)
      )
    }
  }
})
