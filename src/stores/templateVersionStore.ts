import { defineStore } from 'pinia'
import { ref } from 'vue'

import { api } from '@/scripts/api'

export const useTemplateVersionStore = defineStore('templateVersion', () => {
  const workflowsTemplatesVersion = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTemplateVersion() {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.getTemplatesVersion()
      workflowsTemplatesVersion.value = response.version
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch template version'
      console.error('Error fetching template version:', err)
      workflowsTemplatesVersion.value = ''
    } finally {
      isLoading.value = false
    }
  }

  return {
    workflowsTemplatesVersion,
    isLoading,
    error,
    fetchTemplateVersion
  }
})
