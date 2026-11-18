<script setup lang="ts">
import { useTimeout } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'

import type { FollowLanding } from '@/workbench/extensions/agent/composables/agent/useAgentWorkflowChatFollow'
import type { AgentGreeting } from '@/workbench/extensions/agent/types/proactiveGreeting'
import type { AgentStarterPromptAttribution } from '@/workbench/extensions/agent/utils/starterPrompts'

import EmptyState from './EmptyState.vue'

const LOADING_STATE_DELAY_MS = 120

const {
  openingWorkflowName,
  landing = null,
  userName,
  hasSelection = false,
  greeting
} = defineProps<{
  openingWorkflowName?: string
  landing?: FollowLanding | null
  userName?: string
  hasSelection?: boolean
  greeting?: AgentGreeting
}>()
const emit = defineEmits<{
  insert: [text: string, prompt: AgentStarterPromptAttribution]
  prefilled: [delayMs: number]
  retry: []
}>()

const { t } = useI18n()

const openingTabChat = computed(() => openingWorkflowName !== undefined)

const {
  ready: loadingStateReady,
  start: startLoadingDelay,
  stop: stopLoadingDelay
} = useTimeout(LOADING_STATE_DELAY_MS, { controls: true, immediate: false })
watch(
  openingTabChat,
  (opening) => {
    if (opening) startLoadingDelay()
    else stopLoadingDelay()
  },
  { immediate: true, flush: 'sync' }
)

const retryImmediate = ref(false)
const {
  ready: landingDelayReady,
  start: startLandingDelay,
  stop: stopLandingDelay
} = useTimeout(LOADING_STATE_DELAY_MS, { controls: true, immediate: false })
const showLandingLoading = computed(
  () =>
    landing?.status === 'loading' &&
    (landingDelayReady.value || retryImmediate.value)
)
watch(
  () => landing,
  (next, prev) => {
    if (next === null) {
      retryImmediate.value = false
      stopLandingDelay()
      return
    }
    if (next.status === 'failed') {
      stopLandingDelay()
      retryImmediate.value = true
      return
    }
    if (
      prev === null ||
      prev === undefined ||
      prev.workflowName !== next.workflowName
    ) {
      retryImmediate.value = false
      startLandingDelay()
    }
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
  <div
    v-else-if="landing !== null"
    data-testid="workflow-chat-landing"
    :aria-busy="landing.status === 'loading'"
    class="flex h-full flex-col items-center justify-center px-4 py-8"
  >
    <div
      v-if="showLandingLoading"
      role="status"
      :aria-label="
        t('agent.loadingWorkflowChats', { workflowName: landing.workflowName })
      "
      class="flex w-full max-w-[608px] flex-col gap-2 px-2 py-1"
    >
      <Skeleton
        v-for="row in 3"
        :key="row"
        data-testid="workflow-chat-loading-placeholder"
        class="h-4 w-full"
      />
    </div>
    <div
      v-else-if="landing.status === 'failed'"
      role="alert"
      class="flex w-full max-w-[608px] items-center gap-2 px-2 py-1 text-sm"
    >
      <span class="min-w-0 flex-1 text-destructive">
        {{
          t('agent.followedChatOpenFailed', {
            workflowName: landing.workflowName
          })
        }}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        :aria-label="
          t('agent.retryFollowedChat', { workflowName: landing.workflowName })
        "
        @click="emit('retry')"
      >
        {{ t('g.retry') }}
      </Button>
    </div>
  </div>
  <EmptyState
    v-else
    data-testid="agent-empty-state"
    :user-name
    :greeting
    :has-selection
    @prefilled="emit('prefilled', $event)"
    @insert="(text, prompt) => emit('insert', text, prompt)"
  />
</template>
