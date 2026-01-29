import { ref, shallowRef } from 'vue'

import type { EnrichedModel } from '@/platform/models/browser/types/modelBrowserTypes'
import { useModelStore } from '@/stores/modelStore'
import { transformToEnrichedModel } from '@/platform/models/browser/utils/modelTransform'

const modelCache = {
  data: null as EnrichedModel[] | null,
  timestamp: 0,
  CACHE_TTL: 5 * 60 * 1000
}

let loadingPromise: Promise<void> | null = null

/**
 * Composable for loading models from the model store
 * Handles loading state, errors, model transformation, caching, and race conditions
 */
export function useModelLoader() {
  const modelStore = useModelStore()

  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const models = shallowRef<EnrichedModel[]>([])

  async function loadModels(force = false) {
    const now = Date.now()
    const isCacheFresh =
      modelCache.data && now - modelCache.timestamp < modelCache.CACHE_TTL

    if (!force && isCacheFresh) {
      models.value = modelCache.data!
      return
    }

    if (loadingPromise) {
      return loadingPromise
    }

    isLoading.value = true
    error.value = null

    loadingPromise = (async () => {
      try {
        await modelStore.loadModelFolders()
        await modelStore.loadModels()

        const enrichedModels: EnrichedModel[] = []

        for (const folder of modelStore.modelFolders) {
          const folderModels = Object.values(folder.models)
          for (const model of folderModels) {
            enrichedModels.push(
              transformToEnrichedModel(model, folder.directory)
            )
          }
        }

        models.value = enrichedModels

        modelCache.data = enrichedModels
        modelCache.timestamp = Date.now()
      } catch (err) {
        error.value =
          err instanceof Error ? err : new Error('Failed to load models')
        console.error('Error loading models:', err)
        throw err
      } finally {
        isLoading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  function retryLoad() {
    return loadModels(true)
  }

  function clearCache() {
    modelCache.data = null
    modelCache.timestamp = 0
  }

  return {
    isLoading,
    error,
    models,
    loadModels,
    retryLoad,
    clearCache
  }
}
