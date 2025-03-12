import { whenever } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { useCivitaiModel } from '@/composables/useCivitaiModel'
import { isCivitaiModelUrl } from '@/utils/formatUtil'

export function useDownload(url: string, fileName?: string) {
  const fileSize = ref<number | null>(null)

  const setFileSize = (size: number) => {
    fileSize.value = size
  }

  const fetchFileSize = async () => {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (!response.ok) throw new Error('Failed to fetch file size')

      const size = response.headers.get('content-length')
      if (size) {
        setFileSize(parseInt(size))
      } else {
        console.error('"content-length" header not found')
        return null
      }
    } catch (e) {
      console.error('Error fetching file size:', e)
      return null
    }
  }

  /**
   * Trigger browser download
   */
  const triggerBrowserDownload = () => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || url.split('/').pop() || 'download'
    link.target = '_blank' // Opens in new tab if download attribute is not supported
    link.rel = 'noopener noreferrer' // Security best practice for _blank links
    link.click()
  }

  onMounted(() => {
    if (isCivitaiModelUrl(url)) {
      const { fileSize: civitaiSize, error: civitaiErr } = useCivitaiModel(url)
      whenever(civitaiSize, setFileSize)
      // Try falling back to normal fetch if using Civitai API fails
      whenever(civitaiErr, fetchFileSize, { once: true })
    } else {
      fetchFileSize()
    }
  })

  return {
    triggerBrowserDownload,
    fileSize
  }
}
