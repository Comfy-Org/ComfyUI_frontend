import type { Ref } from 'vue'
import { ref } from 'vue'

import { downloadFileAsync } from '@/base/common/downloadUtil'

export function useDownloadFile(): {
  isLoading: Ref<boolean>
  error: Ref<Error | undefined>
  execute: (url: string, filename?: string) => Promise<void>
} {
  const isLoading = ref(false)
  const error = ref<Error | undefined>()

  async function execute(url: string, filename?: string): Promise<void> {
    if (isLoading.value) return
    error.value = undefined
    isLoading.value = true
    try {
      await downloadFileAsync(url, filename)
    } catch (e) {
      error.value =
        e instanceof Error ? e : new Error('Failed to download file')
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, error, execute }
}
