import { api } from '@/scripts/api'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useOutputsStore = defineStore('outputs', () => {
  const outputs = ref<string[]>([])
  const isLoadingOutputFiles = ref(false)
  const thePromise = ref<Promise<void> | null>(null)

  const outputImages = computed(() => {
    return outputs.value.filter((filename) => {
      const ext = filename.toLowerCase().split('.').pop() || ''
      return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'].includes(ext)
    })
  })
  const outputVideos = computed(() => {
    return outputs.value.filter((filename) => {
      const ext = filename.toLowerCase().split('.').pop() || ''
      return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
    })
  })
  const outputAudios = computed(() => {
    return outputs.value.filter((filename) => {
      const ext = filename.toLowerCase().split('.').pop() || ''
      return ['mp3', 'ogg', 'wav', 'flac'].includes(ext)
    })
  })

  /**
   * Fetch output files from the backend API
   */
  async function _fetchOutputFiles() {
    isLoadingOutputFiles.value = true
    try {
      const response = await fetch(api.internalURL('/files/output'), {
        headers: {
          'Comfy-User': api.user
        }
      })

      if (!response.ok) {
        console.error('Failed to fetch output files:', response.statusText)
        return
      }

      outputs.value = await response.json()
    } catch (error) {
      console.error('Error fetching output files:', error)
    } finally {
      isLoadingOutputFiles.value = false
    }
  }

  const fetchOutputFiles = async () => {
    if (!thePromise.value) {
      thePromise.value = _fetchOutputFiles()
      thePromise.value.finally(() => {
        thePromise.value = null
      })
    }
    return thePromise.value
  }

  return {
    isLoadingOutputFiles,
    outputs,
    fetchOutputFiles,
    outputImages,
    outputVideos,
    outputAudios
  }
})
