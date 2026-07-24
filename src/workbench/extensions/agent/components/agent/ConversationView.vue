<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { ConversationEntry } from '../../stores/agent/agentConversationStore'

import AgentMessage from './message/AgentMessage.vue'
import UserMessage from './message/UserMessage.vue'

const { entries } = defineProps<{
  entries: ConversationEntry[]
}>()
const emit = defineEmits<{
  feedback: [turnId: string, vote: 'up' | 'down' | null]
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
            />
            <AgentMessage
              v-else
              :message="entry"
              @feedback="emit('feedback', entry.id, $event)"
            />
          </template>
          <div ref="bottom" />
        </div>
      </div>
    </div>

    <button
      v-if="!atBottom"
      type="button"
      class="rounded-agent border-agent-border bg-agent-surface-raised text-agent-fg-muted hover:text-agent-fg absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 border px-3 py-1.5 text-xs shadow-md transition-colors"
      @click="scrollToLatest"
    >
      <span class="icon-[lucide--arrow-down] size-3.5" />
      {{ t('agent.latest') }}
    </button>
  </div>
</template>
