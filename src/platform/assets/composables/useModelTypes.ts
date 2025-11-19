import { ref } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { api } from '@/scripts/api'

/**
 * Format folder name to display name
 * Converts "upscale_models" -> "Upscale Models"
 * Converts "loras" -> "LoRAs"
 */
function formatDisplayName(folderName: string): string {
  // Special cases for acronyms and proper nouns
  const specialCases: Record<string, string> = {
    loras: 'LoRAs',
    ipadapter: 'IP-Adapter',
    sams: 'SAMs',
    clip_vision: 'CLIP Vision',
    animatediff_motion_lora: 'AnimateDiff Motion LoRA',
    animatediff_models: 'AnimateDiff Models',
    vae: 'VAE',
    sam2: 'SAM 2',
    controlnet: 'ControlNet',
    gligen: 'GLIGEN'
  }

  if (specialCases[folderName]) {
    return specialCases[folderName]
  }

  return folderName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

interface ModelTypeOption {
  name: string // Display name
  value: string // Actual tag value
}

/**
 * Composable for fetching and managing model types from the API
 * Uses shared state to ensure data is only fetched once
 */
export const useModelTypes = createSharedComposable(() => {
  const modelTypes = ref<ModelTypeOption[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let fetchPromise: Promise<void> | null = null

  /**
   * Fetch model types from the API (only fetches once, subsequent calls reuse the same promise)
   */
  async function fetchModelTypes() {
    // If already loaded, return immediately
    if (modelTypes.value.length > 0) {
      return
    }

    // If currently loading, return the existing promise
    if (fetchPromise) {
      return fetchPromise
    }

    isLoading.value = true
    error.value = null

    fetchPromise = (async () => {
      try {
        const response = await api.getModelFolders()
        modelTypes.value = response.map((folder) => ({
          name: formatDisplayName(folder.name),
          value: folder.name
        }))
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : 'Failed to fetch model types'
        console.error('Failed to fetch model types:', err)
      } finally {
        isLoading.value = false
        fetchPromise = null
      }
    })()

    return fetchPromise
  }

  return {
    modelTypes,
    isLoading,
    error,
    fetchModelTypes
  }
})
