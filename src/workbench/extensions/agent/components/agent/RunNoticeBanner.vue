<script setup lang="ts">
import { useStorage, useTimeout } from '@vueuse/core'
import { computed, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const {
  expanded = false,
  workflowName,
  engaged = false,
  context
} = defineProps<{
  expanded?: boolean
  workflowName?: string
  engaged?: boolean
  context?: 'following' | 'mismatch' | 'unavailable'
}>()

const emit = defineEmits<{ showTarget: [] }>()
const dismissed = useStorage('Comfy.AgentPanel.runNoticeDismissed', false)
const contextMessages = {
  following: 'agent.targetFollowsVisibleWorkflow',
  mismatch: 'agent.viewingDifferentWorkflow',
  unavailable: 'agent.targetWorkflowUnavailable'
} as const satisfies Record<NonNullable<typeof context>, string>
const defaultNotice = computed(() =>
  expanded ? 'agent.runNoticeExpanded' : 'agent.runNotice'
)
const { ready, start } = useTimeout(500, {
  controls: true,
  immediate: false
})
watch(
  () => engaged,
  (value) => {
    if (value) start()
  },
  { immediate: true }
)
const visible = computed(
  () =>
    Boolean(context) ||
    (!dismissed.value && Boolean(workflowName || (engaged && ready.value)))
)
</script>

<template>
  <div
    v-if="visible"
    role="note"
    :aria-live="context ? 'polite' : undefined"
    class="relative flex items-start gap-2 overflow-hidden rounded-lg bg-base-background p-4 ring-1 ring-border-subtle before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-muted-background"
  >
    <span
      class="icon-[heroicons--information-circle-20-solid] size-5 shrink-0 text-muted-foreground"
    />
    <p class="my-0 min-w-0 flex-1 text-sm">
      <template v-if="context">
        {{ $t(contextMessages[context]) }}
        <Button
          v-if="context === 'mismatch'"
          type="button"
          variant="muted-textonly"
          size="sm"
          :aria-label="$t('agent.showTargetWorkflow', { workflowName })"
          @click="emit('showTarget')"
        >
          {{ $t('agent.showTarget') }}
          <span class="icon-[lucide--arrow-up-right] size-4" />
        </Button>
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
