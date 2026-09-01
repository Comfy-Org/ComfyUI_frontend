import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { ComposerAttachment } from '../../composables/agent/useComposer'

export const useAgentComposerStore = defineStore('agentComposer', () => {
  const draft = ref('')
  const attachments = ref<ComposerAttachment[]>([])

  return { draft, attachments }
})
