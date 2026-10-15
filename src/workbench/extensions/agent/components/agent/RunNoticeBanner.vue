<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const {
  expanded = false,
  workflowName,
  context
} = defineProps<{
  expanded?: boolean
  workflowName?: string
  context?: 'following' | 'mismatch' | 'unavailable' | 'followFailed'
}>()

const emit = defineEmits<{ showTarget: []; retry: [] }>()
const dismissed = useStorage('Comfy.AgentPanel.runNoticeDismissed', false)
const contextMessages = {
  following: 'agent.targetFollowsVisibleWorkflow',
  mismatch: 'agent.viewingDifferentWorkflow',
  unavailable: 'agent.targetWorkflowUnavailable',
  followFailed: 'agent.followedChatOpenFailed'
} as const satisfies Record<NonNullable<typeof context>, string>
const defaultNotice = computed(() =>
  expanded ? 'agent.runNoticeExpanded' : 'agent.runNotice'
)
const { t } = useI18n()
const contextAction = computed(() => {
  switch (context) {
    case 'mismatch':
      return {
        label: t('agent.showTarget'),
        name: t('agent.showTargetWorkflow', { workflowName }),
        icon: 'icon-[lucide--arrow-up-right] size-4',
        run: () => emit('showTarget')
      }
    case 'followFailed':
      return {
        label: t('g.retry'),
        name: t('agent.retryFollowedChat', { workflowName }),
        icon: '',
        run: () => emit('retry')
      }
    default:
      return undefined
  }
})
</script>

<template>
  <div
    v-if="context || !dismissed"
    role="note"
    :aria-live="context ? 'polite' : undefined"
    class="relative flex items-start gap-2 overflow-hidden rounded-lg bg-base-background p-4 ring-1 ring-border-subtle before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-muted-background"
  >
    <span
      class="icon-[heroicons--information-circle-20-solid] size-5 shrink-0 text-muted-foreground"
    />
    <p class="my-0 min-w-0 flex-1 text-sm text-base-foreground">
      <template v-if="context">
        {{ $t(contextMessages[context], { workflowName }) }}
        <Button
          v-if="contextAction"
          type="button"
          variant="muted-textonly"
          size="sm"
          :aria-label="contextAction.name"
          @click="contextAction.run"
        >
          {{ contextAction.label }}
          <span :class="contextAction.icon" />
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
