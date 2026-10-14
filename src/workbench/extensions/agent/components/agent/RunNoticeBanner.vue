<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Message from '@/components/ui/message/Message.vue'

const {
  expanded = false,
  workflowName,
  context
} = defineProps<{
  expanded?: boolean
  workflowName?: string
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
</script>

<template>
  <Message
    v-if="context || !dismissed"
    severity="secondary"
    role="note"
    :aria-live="context ? 'polite' : 'off'"
  >
    <template #icon>
      <span
        class="icon-[heroicons--information-circle-20-solid] block size-5 text-muted-foreground"
      />
    </template>
    <div class="flex items-start gap-2">
      <p class="my-0 min-w-0 flex-1">
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
  </Message>
</template>
