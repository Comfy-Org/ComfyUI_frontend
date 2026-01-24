import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

type PromptPreviewMap = Record<string, string>

export const useJobPreviewStore = defineStore('jobPreview', () => {
  const settingStore = useSettingStore()
  const previewsByPromptId = ref<PromptPreviewMap>({})

  const previewMethod = computed(() =>
    settingStore.get('Comfy.Execution.PreviewMethod')
  )
  const isPreviewEnabled = computed(() => previewMethod.value !== 'none')

  function revokePreviewUrl(url: string | undefined) {
    if (!url) return
    URL.revokeObjectURL(url)
  }

  function setPreviewUrl(promptId: string, url: string) {
    const current = previewsByPromptId.value[promptId]
    if (current) revokePreviewUrl(current)
    previewsByPromptId.value = {
      ...previewsByPromptId.value,
      [promptId]: url
    }
  }

  function setPreviewFromBlob(promptId: string | undefined, blob: Blob) {
    if (!promptId || !isPreviewEnabled.value) return
    const url = URL.createObjectURL(blob)
    setPreviewUrl(promptId, url)
  }

  function clearPreview(promptId: string | undefined) {
    if (!promptId) return
    const current = previewsByPromptId.value[promptId]
    if (!current) return
    revokePreviewUrl(current)
    const next = { ...previewsByPromptId.value }
    delete next[promptId]
    previewsByPromptId.value = next
  }

  function clearAllPreviews() {
    Object.values(previewsByPromptId.value).forEach((url) =>
      revokePreviewUrl(url)
    )
    previewsByPromptId.value = {}
  }

  watch(isPreviewEnabled, (enabled) => {
    if (!enabled) clearAllPreviews()
  })

  return {
    previewsByPromptId,
    isPreviewEnabled,
    setPreviewFromBlob,
    clearPreview,
    clearAllPreviews
  }
})
