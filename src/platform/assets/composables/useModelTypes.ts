import { createSharedComposable, useAsyncState } from '@vueuse/core'

import { api } from '@/scripts/api'

/**
 * Format folder name to display name
 * Converts "upscale_models" -> "Upscale Model"
 * Converts "loras" -> "LoRA"
 */
function formatDisplayName(folderName: string): string {
  // Special cases for acronyms and proper nouns
  const specialCases: Record<string, string> = {
    loras: 'LoRA',
    ipadapter: 'IP-Adapter',
    sams: 'SAM',
    clip_vision: 'CLIP Vision',
    animatediff_motion_lora: 'AnimateDiff Motion LoRA',
    animatediff_models: 'AnimateDiff Model',
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
  const {
    state: modelTypes,
    isLoading,
    error,
    execute: fetchModelTypes
  } = useAsyncState(
    async (): Promise<ModelTypeOption[]> => {
      const response = await api.getModelFolders()
      return response
        .map((folder) => ({
          name: formatDisplayName(folder.name),
          value: folder.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    [] as ModelTypeOption[],
    {
      immediate: false,
      onError: (err) => {
        console.error('Failed to fetch model types:', err)
      }
    }
  )

  return {
    modelTypes,
    isLoading,
    error,
    fetchModelTypes
  }
})
