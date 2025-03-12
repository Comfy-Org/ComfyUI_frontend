import { useAsyncState } from '@vueuse/core'
import { computed } from 'vue'

type ModelType =
  | 'Checkpoint'
  | 'TextualInversion'
  | 'Hypernetwork'
  | 'AestheticGradient'
  | 'LORA'
  | 'Controlnet'
  | 'Poses'

interface CivitaiFileMetadata {
  fp?: 'fp16' | 'fp32'
  size?: 'full' | 'pruned'
  format?: 'SafeTensor' | 'PickleTensor' | 'Other'
}

interface CivitaiModelFile {
  name: string
  id: number
  sizeKB: number
  type: string
  downloadUrl: string
  metadata: CivitaiFileMetadata
}

interface CivitaiModel {
  name: string
  type: ModelType
}

interface CivitaiModelVersionResponse {
  id: number
  name: string
  model: CivitaiModel
  modelId: number
  files: CivitaiModelFile[]
  [key: string]: any
}

/**
 * Composable to manage Civitai model
 * @param url - The URL of the Civitai model, where the model ID is the last part of the URL's pathname
 * @see https://developer.civitai.com/docs/api/public-rest
 * @example
 * const { fileSize, isLoading, error, modelData } =
 *  useCivitaiModel('https://civitai.com/api/download/models/16576?type=Model&format=SafeTensor&size=full&fp=fp16')
 */
export function useCivitaiModel(url: string) {
  const createModelVersionUrl = (modelId: string): string =>
    `https://civitai.com/api/v1/model-versions/${modelId}`

  const extractModelIdFromUrl = (): string | null => {
    const urlObj = new URL(url)
    return urlObj.pathname.split('/').pop() || null
  }

  const fetchModelData =
    async (): Promise<CivitaiModelVersionResponse | null> => {
      const modelId = extractModelIdFromUrl()
      if (!modelId) return null

      const apiUrl = createModelVersionUrl(modelId)
      const res = await fetch(apiUrl)
      return res.json()
    }

  const findMatchingFileSize = (): number | null => {
    const matchingFile = modelData.value?.files?.find(
      (file) => file.downloadUrl && url.startsWith(file.downloadUrl)
    )

    return matchingFile?.sizeKB ? matchingFile.sizeKB << 10 : null
  }

  const {
    state: modelData,
    isLoading,
    error
  } = useAsyncState(fetchModelData, null, {
    immediate: true
  })

  const fileSize = computed(() =>
    !isLoading.value ? findMatchingFileSize() : null
  )

  return {
    fileSize,
    isLoading,
    error,
    modelData
  }
}
