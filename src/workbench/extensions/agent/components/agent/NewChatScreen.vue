<script setup lang="ts">
import { useTimeout } from '@vueuse/core'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { FollowLanding } from '@/workbench/extensions/agent/composables/agent/useAgentWorkflowChatFollow'
import type { AgentStarterPromptAttribution } from '@/workbench/extensions/agent/utils/starterPrompts'

import EmptyState from './EmptyState.vue'
import WorkflowChatList from './WorkflowChatList.vue'

const LOADING_STATE_DELAY_MS = 120

const {
  openingWorkflowName,
  landing = null,
  userName,
  hasSelection = false
} = defineProps<{
  openingWorkflowName?: string
  landing?: FollowLanding | null
  userName?: string
  hasSelection?: boolean
}>()
const emit = defineEmits<{
  insert: [text: string, prompt: AgentStarterPromptAttribution]
  selectChat: [id: string]
  retry: []
  showAll: []
}>()

const { t } = useI18n()

const openingTabChat = computed(() => openingWorkflowName !== undefined)
const openingListedChat = computed(() => (landing?.openingId ?? null) !== null)
const loadingChats = computed(() => landing?.status === 'loading')

const { ready: loadingStateReady, start: startLoadingDelay } = useTimeout(
  LOADING_STATE_DELAY_MS,
  { controls: true, immediate: false }
)
watch(
  openingTabChat,
  (opening) => {
    if (opening) startLoadingDelay()
  },
  { immediate: true, flush: 'sync' }
)
</script>

<template>
  <div
    v-if="openingTabChat"
    aria-busy="true"
    class="flex h-full items-center justify-center px-6 text-center text-sm"
  >
    <div
      v-if="loadingStateReady"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      :aria-label="
        t('agent.openingWorkflowChat', { workflowName: openingWorkflowName })
      "
      class="flex items-center justify-center gap-2"
    >
      <i
        aria-hidden="true"
        class="icon-[lucide--loader-circle] motion-safe:animate-spin"
      />
      {{
        t('agent.openingWorkflowChat', { workflowName: openingWorkflowName })
      }}
    </div>
  </div>
  <EmptyState
    v-else
    data-testid="agent-empty-state"
    :aria-busy="openingListedChat || loadingChats"
    :inert="openingListedChat"
    :user-name
    :has-selection
    :show-intro="landing === null"
    @insert="(text, prompt) => emit('insert', text, prompt)"
  >
    <WorkflowChatList
      v-if="landing"
      :landing
      @select="emit('selectChat', $event)"
      @retry="emit('retry')"
      @show-all="emit('showAll')"
    />
  </EmptyState>
</template>
