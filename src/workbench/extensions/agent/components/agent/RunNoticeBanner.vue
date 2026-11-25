<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Message from '@comfyorg/design-system/message/Message'
import { useSafeLocalStorage } from '@/platform/storage/useSafeStorage'

import RunNoticeAction from './RunNoticeAction.vue'

const {
  expanded = false,
  workflowName,
  followsVisibleWorkflow = false,
  genericNoticeReady = false,
  hideIntro = false,
  context
} = defineProps<{
  expanded?: boolean
  workflowName?: string
  followsVisibleWorkflow?: boolean
  genericNoticeReady?: boolean
  hideIntro?: boolean
  context?: 'mismatch' | 'unavailable' | 'emptyCanvas'
}>()

const emit = defineEmits<{ showTarget: []; newChat: [] }>()
const dismissed = useSafeLocalStorage(
  'Comfy.AgentPanel.runNoticeDismissed',
  false
)
const contextMessages = {
  mismatch: 'agent.viewingDifferentWorkflow',
  unavailable: 'agent.targetWorkflowUnavailable',
  emptyCanvas: 'agent.canvasIsEmptyAfterTurn'
} as const satisfies Record<NonNullable<typeof context>, string>
const defaultNotice = computed(() =>
  expanded ? 'agent.runNoticeExpanded' : 'agent.runNotice'
)
const followsNamedWorkflow = computed(
  () => followsVisibleWorkflow && Boolean(workflowName)
)
const visible = computed(
  () =>
    Boolean(context) ||
    (!hideIntro &&
      !dismissed.value &&
      !followsNamedWorkflow.value &&
      Boolean(workflowName || genericNoticeReady))
)
const liveness = computed(() => (context ? 'polite' : undefined))
const contextAction = computed(() => {
  switch (context) {
    case 'mismatch':
      return {
        label: 'agent.showTarget',
        name: 'agent.showTargetWorkflow',
        icon: 'icon-[lucide--arrow-up-right]',
        run: () => emit('showTarget')
      }
    case 'unavailable':
      return {
        label: 'agent.newChat',
        name: 'agent.startNewChat',
        run: () => emit('newChat')
      }
    default:
      return undefined
  }
})
</script>

<template>
  <Message
    v-if="visible"
    severity="secondary"
    role="note"
    :data-testid="context ? `agent-run-notice-${context}` : undefined"
    :aria-live="liveness ?? 'off'"
  >
    <template #icon>
      <i
        aria-hidden="true"
        class="icon-[heroicons--information-circle-20-solid] size-5 text-muted-foreground"
      />
    </template>
    <div class="flex items-start gap-2">
      <p class="my-0 min-w-0 flex-1">
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
        <i aria-hidden="true" class="icon-[lucide--x] size-5" />
      </Button>
    </div>
  </Message>
</template>
