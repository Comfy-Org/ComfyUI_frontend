<script setup lang="ts">
import { computed } from 'vue'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { useAccountStorage } from '@/platform/workflow/persistence/composables/useAccountStorage'
import Button from '@comfyorg/design-system/button/Button'

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
const dismissed = useAccountStorage(StorageKeys.agentRunNoticeDismissed, false)
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
  <div
    v-if="visible"
    role="note"
    :data-testid="context ? `agent-run-notice-${context}` : undefined"
    :aria-live="liveness"
    class="relative flex items-start gap-2 overflow-hidden rounded-lg bg-background p-4 ring-1 ring-border/50 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-muted"
  >
    <i
      aria-hidden="true"
      class="icon-[heroicons--information-circle-20-solid] size-5 text-muted-foreground"
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
      <i aria-hidden="true" class="icon-[lucide--x] size-5" />
    </Button>
  </div>
</template>
