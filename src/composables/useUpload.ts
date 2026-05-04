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

export const UPLOAD_SKIPPED_ERROR = 'UPLOAD_SKIPPED_ALREADY_IN_PROGRESS'

function skippedResult(): UploadResult {
  return {
    success: false,
    path: '',
    name: '',
    subfolder: '',
    error: UPLOAD_SKIPPED_ERROR,
    response: null
  }
}

/**
 * Loading-state wrapper around `uploadMedia` / `uploadMediaBatch`.
 * Concurrent calls while `loading` is true resolve to an unsuccessful
 * `UploadResult` with `error === UPLOAD_SKIPPED_ERROR` (matches
 * `uploadMedia`'s error-as-value pattern — callers check
 * `result.success`, not `try/catch`). Consumers surfacing errors to
 * the user should localize this sentinel at the UI boundary.
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
