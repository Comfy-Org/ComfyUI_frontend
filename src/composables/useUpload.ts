import { ref } from 'vue'

import {
  uploadMedia,
  uploadMediaBatch
} from '@/platform/assets/services/uploadService'
import type {
  UploadConfig,
  UploadInput,
  UploadResult
} from '@/platform/assets/services/uploadService'

function skippedResult(): UploadResult {
  return {
    success: false,
    path: '',
    name: '',
    subfolder: '',
    error: 'Upload already in progress',
    response: null
  }
}

/**
 * Loading-state wrapper around `uploadMedia` / `uploadMediaBatch`.
 * Concurrent calls while `loading` is true resolve to an unsuccessful
 * `UploadResult` (matches `uploadMedia`'s error-as-value pattern —
 * callers check `result.success`, not `try/catch`).
 */
export function useUpload() {
  const loading = ref(false)

  async function upload(
    input: UploadInput,
    config?: UploadConfig
  ): Promise<UploadResult> {
    if (loading.value) return skippedResult()
    loading.value = true
    try {
      return await uploadMedia(input, config)
    } finally {
      loading.value = false
    }
  }

  async function uploadBatch(
    inputs: UploadInput[],
    config?: UploadConfig
  ): Promise<UploadResult[]> {
    if (loading.value) return inputs.map(() => skippedResult())
    loading.value = true
    try {
      return await uploadMediaBatch(inputs, config)
    } finally {
      loading.value = false
    }
  }

  return { loading, upload, uploadBatch }
}
