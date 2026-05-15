import { createSharedComposable, useAsyncState } from '@vueuse/core'

import { api } from '@/scripts/api'
import { t } from '@/i18n'

/**
 * Format folder name to display name
 * Converts "upscale_models" -> "Upscale Model"
 * Converts "loras" -> "LoRA"
 */
function formatDisplayName(folderName: string): string {
  const key = `modelTypeNames.${folderName}`
  const translated = t(key)
  if (translated !== key) return translated

  // Fallback: format from underscore to title case
  return folderName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Descriptions for model folders - shown as tooltips
 */
function getModelFolderDescription(folderName: string): string {
  const key = `modelTypeDescriptions.${folderName}`
  const translated = t(key)
  if (translated !== key) return translated

  return 'Store ' + formatDisplayName(folderName) + ' model files'
}

interface ModelTypeOption {
  name: string // Display name
  value: string // Actual tag value
}

const DISALLOWED_MODEL_TYPES = ['nlf'] as const

/**
 * Composable for fetching and managing model types from the API
 * Uses shared state to ensure data is only fetched once
 */
export const useModelTypes = createSharedComposable(() => {
  const {
    state: modelTypes,
    isReady,
    isLoading,
    error,
    execute
  } = useAsyncState(
    async (): Promise<ModelTypeOption[]> => {
      const response = await api.getModelFolders()
      return response
        .filter(
          (folder) =>
            !DISALLOWED_MODEL_TYPES.includes(
              folder.name as (typeof DISALLOWED_MODEL_TYPES)[number]
            )
        )
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

  async function fetchModelTypes() {
    if (isReady.value || isLoading.value) return
    await execute()
  }

  return {
    modelTypes,
    isLoading,
    error,
    fetchModelTypes
  }
})
