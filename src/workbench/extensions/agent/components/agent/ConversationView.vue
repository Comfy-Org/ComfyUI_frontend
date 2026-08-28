<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildAgentTooltipConfig } from '@/composables/useTooltipConfig'

import { cn } from '@comfyorg/tailwind-utils'

import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import type { TurnId } from '../../schemas/agentApiSchema'

import AgentMessage from './message/AgentMessage.vue'
import UserMessage from './message/UserMessage.vue'

const {
  entries,
  editableTurnId = null,
  answeringAskIds = new Set<string>()
} = defineProps<{
  entries: ConversationEntry[]
  editableTurnId?: TurnId | null
  answeringAskIds?: ReadonlySet<string>
}>()
const emit = defineEmits<{
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  editPrompt: [text: string]
  answerAsk: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [workflowId: string, workflowName?: string]
}>()

const { t } = useI18n()

const bottom = ref<HTMLElement>()
const atBottom = ref(true)

useIntersectionObserver(bottom, ([entry]) => {
  atBottom.value = entry?.isIntersecting ?? true
})

const top = ref<HTMLElement>()
const atTop = ref(true)

useIntersectionObserver(top, ([entry]) => {
  atTop.value = entry?.isIntersecting ?? true
})

function scrollToLatest(): void {
  bottom.value?.scrollIntoView({ block: 'end' })
}

const latestContentSignal = computed(() => {
  const last = entries.at(-1)
  if (!last) return '0'
  const size = 'parts' in last ? JSON.stringify(last.parts).length : 0
  return `${entries.length}:${size}`
})

watch(
  latestContentSignal,
  async () => {
    if (!atBottom.value) return
    await nextTick()
    scrollToLatest()
  },
  { flush: 'post' }
)
</script>

<template>
  <div class="relative h-full">
    <div
      :class="
        cn(
          'h-full overflow-y-auto',
          !atTop && 'mask-t-from-[calc(100%-2rem)]',
          !atBottom && 'mask-b-from-[calc(100%-2rem)]'
        )
      "
    >
      <div ref="top" />
      <div class="mx-auto max-w-[640px] p-4">
        <div class="flex flex-col gap-4">
          <template v-for="entry in entries" :key="`${entry.role}-${entry.id}`">
            <UserMessage
              v-if="entry.role === 'user'"
              :text="entry.text"
              :attachments="entry.attachments"
              :tags="entry.tags"
              :editable="entry.id === editableTurnId"
              @edit="emit('editPrompt', $event)"
            />
            <AgentMessage
              v-else
              :message="entry"
              :answering-ask-ids="answeringAskIds"
              @feedback="emit('feedback', entry.id, $event)"
              @answer-ask="
                (askId, selection) => emit('answerAsk', askId, selection)
              "
              @open-workflow="
                (workflowId, workflowName) =>
                  emit('openWorkflow', workflowId, workflowName)
              "
            />
          </template>
          <div ref="bottom" />
        </div>
      </div>
    </div>

    <button
      v-if="!atBottom"
      v-tooltip.top="buildAgentTooltipConfig(t('agent.latest'))"
      type="button"
      :aria-label="t('agent.latest')"
      class="text-secondary-foreground absolute bottom-2 left-1/2 flex size-8 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-secondary-background shadow-md ring-1 ring-muted-foreground transition-colors hover:bg-secondary-background-hover"
      @click="scrollToLatest"
    >
      <span class="icon-[lucide--chevron-down] size-4" />
    </button>
  </div>
</template>
