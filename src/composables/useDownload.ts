import { ref } from 'vue'

import { downloadFileAsync } from '@/base/common/downloadUtil'

export function useDownload() {
  const loading = ref(false)

  async function download(url: string, filename?: string): Promise<void> {
    loading.value = true
    try {
      await downloadFileAsync(url, filename)
    } finally {
      loading.value = false
    }
  }

  return { loading, download }
}
