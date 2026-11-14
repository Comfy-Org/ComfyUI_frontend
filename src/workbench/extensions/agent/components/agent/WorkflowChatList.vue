<script setup lang="ts">
import { useTimeout } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'

import type { FollowLanding } from '@/workbench/extensions/agent/composables/agent/useAgentWorkflowChatFollow'

import ChatHistorySelectButton from './ChatHistorySelectButton.vue'

const LOADING_STATE_DELAY_MS = 120

const { landing } = defineProps<{ landing: FollowLanding }>()
const emit = defineEmits<{
  select: [id: string]
  retry: []
  showAll: []
}>()

const { t } = useI18n()

const { ready: loadingStateReady } = useTimeout(LOADING_STATE_DELAY_MS, {
  controls: true
})
const waitingToShowLoading = computed(
  () => landing.status === 'loading' && !loadingStateReady.value
)
</script>

<template>
  <section
    v-if="!waitingToShowLoading"
    data-testid="workflow-chat-list"
    :aria-label="
      t('agent.workflowChats.title', { workflowName: landing.workflowName })
    "
    :aria-busy="landing.status === 'loading'"
    class="flex w-full max-w-[608px] flex-col gap-1 text-left"
  >
    <h2 class="m-0 px-2 text-xs font-normal text-muted-foreground">
      {{
        t('agent.workflowChats.title', { workflowName: landing.workflowName })
      }}
    </h2>
    <div
      v-if="landing.status === 'loading'"
      role="status"
      :aria-label="
        t('agent.workflowChats.loading', { workflowName: landing.workflowName })
      "
      class="flex flex-col gap-2 px-2 py-1"
    >
      <Skeleton
        v-for="row in 3"
        :key="row"
        data-testid="workflow-chat-list-placeholder"
        class="h-4 w-full"
      />
    </div>
    <div
      v-else-if="landing.status === 'failed'"
      role="alert"
      class="flex items-center gap-2 px-2 py-1 text-xs"
    >
      <span class="min-w-0 flex-1 text-destructive">
        {{
          t('agent.workflowChats.loadFailed', {
            workflowName: landing.workflowName
          })
        }}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        :aria-label="
          t('agent.workflowChats.retry', { workflowName: landing.workflowName })
        "
        @click="emit('retry')"
      >
        {{ t('g.retry') }}
      </Button>
    </div>
    <template v-else>
      <ul class="m-0 flex list-none flex-col p-0">
        <li
          v-for="chat in landing.chats"
          :key="chat.id"
          class="flex items-center rounded-sm px-2 py-1 hover:bg-accent"
        >
          <ChatHistorySelectButton
            :title="chat.title"
            :loading="landing.openingId === chat.id"
            :failed="landing.failedId === chat.id"
            @select="emit('select', chat.id)"
          />
        </li>
      </ul>
      <Button
        v-if="landing.hasMore"
        type="button"
        variant="muted-textonly"
        size="sm"
        class="self-start"
        @click="emit('showAll')"
      >
        {{ t('agent.workflowChats.allChats') }}
      </Button>
    </template>
  </section>
</template>
