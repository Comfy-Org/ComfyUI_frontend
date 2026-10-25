<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import RunNoticeAction from './RunNoticeAction.vue'

const {
  expanded = false,
  workflowName,
  genericNoticeReady = false,
  context
} = defineProps<{
  expanded?: boolean
  workflowName?: string
  genericNoticeReady?: boolean
  context?:
    | 'following'
    | 'mismatch'
    | 'unavailable'
    | 'emptyCanvas'
    | 'followFailed'
}>()

const emit = defineEmits<{ showTarget: []; retry: [] }>()
const dismissed = useStorage('Comfy.AgentPanel.runNoticeDismissed', false)
const contextMessages = {
  following: 'agent.targetFollowsVisibleWorkflow',
  mismatch: 'agent.viewingDifferentWorkflow',
  unavailable: 'agent.targetWorkflowUnavailable',
  emptyCanvas: 'agent.canvasIsEmptyAfterTurn',
  followFailed: 'agent.followedChatOpenFailed'
} as const satisfies Record<NonNullable<typeof context>, string>
const defaultNotice = computed(() =>
  expanded ? 'agent.runNoticeExpanded' : 'agent.runNotice'
)
const visible = computed(
  () =>
    Boolean(context) ||
    (!dismissed.value && Boolean(workflowName || genericNoticeReady))
)
const liveness = computed(() => (context ? 'polite' : undefined))
const contextAction = computed(() => {
  switch (context) {
    case 'mismatch':
      return {
        label: 'agent.showTarget',
        name: 'agent.showTargetWorkflow',
        icon: 'icon-[lucide--arrow-up-right] size-4',
        run: () => emit('showTarget')
      }
    case 'followFailed':
      return {
        label: 'g.retry',
        name: 'agent.retryFollowedChat',
        run: () => emit('retry')
      }
    default:
      return undefined
  }
})
</script>

<template>
  <div
    v-if="visible"
    role="note"
    :data-testid="context ? `agent-run-notice-${context}` : undefined"
    :aria-live="liveness"
    class="relative flex items-start gap-2 overflow-hidden rounded-lg bg-background p-4 ring-1 ring-border/50 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-muted"
  >
    <span
      class="icon-[heroicons--information-circle-20-solid] size-5 shrink-0 text-muted-foreground"
    />
    <p class="my-0 min-w-0 flex-1 text-sm">
      <template v-if="context">
        {{ $t(contextMessages[context], { workflowName }) }}
        <RunNoticeAction
          v-if="contextAction"
          v-bind="contextAction"
          :workflow-name="workflowName"
          @run="contextAction.run"
        />
      </template>
      <i18n-t
        v-else-if="workflowName"
        keypath="agent.workflowEditNotice"
        tag="span"
      >
        <template #workflow>
          <span class="underline decoration-solid">{{ workflowName }}</span>
        </template>
      </i18n-t>
      <template v-else>
        {{ $t(defaultNotice) }}
      </template>
    </p>
    <Button
      v-if="!context"
      type="button"
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="$t('agent.dismiss')"
      class="shrink-0"
      @click="dismissed = true"
    >
      <span class="icon-[lucide--x] size-5" />
    </Button>
  </div>
</template>
