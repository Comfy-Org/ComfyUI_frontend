import { api } from '@/scripts/api'
import { defineStore } from 'pinia'
import { reactive, ref, Ref } from 'vue'

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
  name = ref('')
  /** Directory containing the model, eg 'checkpoints' */
  directory = ref('')
  /** Title / display name of the model, sometimes same as the name but not always */
  title = ref('')
  /** Metadata: architecture ID for the model, such as 'stable-diffusion-xl-v1-base' */
  architecture_id = ref('')
  /** Metadata: author of the model */
  author = ref('')
  /** Metadata: resolution of the model, eg '1024x1024' */
  resolution = ref('')
  /** Metadata: description of the model */
  description = ref('')
  /** Metadata: usage hint for the model */
  usage_hint = ref('')
  /** Metadata: trigger phrase for the model */
  trigger_phrase = ref('')
  /** Metadata: tags list for the model */
  tags: Ref<string[]> = ref([])
  /** Metadata: image for the model */
  image = ref('')
  /** Whether the model metadata has been loaded from the server, used for `load()` */
  has_loaded_metadata = ref(false)

  constructor(name: string, directory: string) {
    this.name.value = name
    this.title.value = name
    this.directory.value = directory
  }

  /** Loads the model metadata from the server, filling in this object if data is available */
  async load(): Promise<void> {
    if (this.has_loaded_metadata.value) {
      return
    }
    const metadata = await api.viewMetadata(
      this.directory.value,
      this.name.value
    )
    if (!metadata) {
      return
    }
    this.title.value =
      _findInMetadata(
        metadata,
        'modelspec.title',
        'title',
        'display_name',
        'name'
      ) || this.name.value
    this.architecture_id.value =
      _findInMetadata(metadata, 'modelspec.architecture', 'architecture') || ''
    this.author.value =
      _findInMetadata(metadata, 'modelspec.author', 'author') || ''
    this.description.value =
      _findInMetadata(metadata, 'modelspec.description', 'description') || ''
    this.resolution.value =
      _findInMetadata(metadata, 'modelspec.resolution', 'resolution') || ''
    this.usage_hint.value =
      _findInMetadata(metadata, 'modelspec.usage_hint', 'usage_hint') || ''
    this.trigger_phrase.value =
      _findInMetadata(metadata, 'modelspec.trigger_phrase', 'trigger_phrase') ||
      ''
    this.image.value =
      _findInMetadata(
        metadata,
        'modelspec.thumbnail',
        'thumbnail',
        'image',
        'icon'
      ) || ''
    const tagsCommaSeparated =
      _findInMetadata(metadata, 'modelspec.tags', 'tags') || ''
    this.tags.value = tagsCommaSeparated.split(',').map((tag) => tag.trim())
    this.has_loaded_metadata.value = true
  }
}

/** Model store for a folder */
export class ModelStore {
  models: Record<string, ComfyModelDef> = reactive({})

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

/** Model store handler, wraps individual per-folder model stores */
export const useModelStore = defineStore('modelStore', {
  state: () => ({
    modelStoreMap: {} as Record<string, ModelStore>
  }),
  actions: {
    async getModelsInFolderCached(folder: string): Promise<ModelStore> {
      if (folder in this.modelStoreMap) {
        return this.modelStoreMap[folder]
      }
      // TODO: needs a lock to avoid overlapping calls
      const models = await api.getModels(folder)
      if (!models) {
        return null
      }
      const store = reactive(new ModelStore(folder, models))
      this.modelStoreMap[folder] = store
      return store
    },
    clearCache() {
      this.modelStoreMap = {}
    }
  }
})
