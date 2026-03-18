import { defineStore } from 'pinia'
import { computed, readonly, ref, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import {
  releaseSharedObjectUrl,
  retainSharedObjectUrl
} from '@/utils/objectUrlUtil'

type PromptPreviewMap = Record<string, string>
interface NodePromptPreview {
  url: string
  nodeId?: string
}

export const useJobPreviewStore = defineStore('jobPreview', () => {
  const settingStore = useSettingStore()
  const nodePreviewsByPromptId = ref<Record<string, NodePromptPreview>>({})

  const previewMethod = computed(() =>
    settingStore.get('Comfy.Execution.PreviewMethod')
  )
  const isPreviewEnabled = computed(() => previewMethod.value !== 'none')

  const previewsByPromptId = computed(() => {
    const result: PromptPreviewMap = {}
    for (const [k, v] of Object.entries(nodePreviewsByPromptId.value)) {
      result[k] = v.url
    }
    return result
  })

  function setPreviewUrl(
    promptId: string | undefined,
    url: string,
    nodeId?: string
  ) {
    if (!promptId || !isPreviewEnabled.value) return
    const current = nodePreviewsByPromptId.value[promptId]
    if (current?.url === url) return
    if (current) releaseSharedObjectUrl(current.url)
    retainSharedObjectUrl(url)
    nodePreviewsByPromptId.value = {
      ...nodePreviewsByPromptId.value,
      [promptId]: { url, nodeId }
    }
  }

  function clearPreview(promptId: string | undefined) {
    if (!promptId) return
    const current = nodePreviewsByPromptId.value[promptId]
    if (!current) return
    releaseSharedObjectUrl(current.url)
    const next = { ...nodePreviewsByPromptId.value }
    delete next[promptId]
    nodePreviewsByPromptId.value = next
  }

  function clearAllPreviews() {
    for (const { url } of Object.values(nodePreviewsByPromptId.value)) {
      releaseSharedObjectUrl(url)
    }
    nodePreviewsByPromptId.value = {}
  }

  watch(isPreviewEnabled, (enabled) => {
    if (!enabled) clearAllPreviews()
  })

  return {
    nodePreviewsByPromptId: readonly(nodePreviewsByPromptId),
    previewsByPromptId,
    isPreviewEnabled,
    setPreviewUrl,
    clearPreview,
    clearAllPreviews
  }
})
