<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { nextTick, ref, watch } from 'vue'

import ScrollArea from '../ui/ScrollArea.vue'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'

import AgentMessage from './message/AgentMessage.vue'
import UserMessage from './message/UserMessage.vue'

const { entries, userName } = defineProps<{
  entries: ConversationEntry[]
  userName?: string
}>()
const emit = defineEmits<{
  feedback: [turnId: string, vote: 'up' | 'down' | null]
}>()

// Keep the newest turn in view as content streams in, but ONLY when the user is already at
// the bottom — if they scrolled up to re-read, a streaming delta must not yank them back.
// The bottom sentinel's visibility is the "at bottom" signal.
const bottom = ref<HTMLElement>()
const atBottom = ref(true)

useIntersectionObserver(bottom, ([entry]) => {
  atBottom.value = entry?.isIntersecting ?? true
})

watch(
  () => entries,
  async () => {
    if (!atBottom.value) return
    await nextTick()
    bottom.value?.scrollIntoView({ block: 'end' })
  },
  { deep: true, flush: 'post' }
)
</script>

<template>
  <ScrollArea class="h-full" viewport-class="px-4 py-3">
    <div class="flex flex-col gap-4">
      <template v-for="entry in entries" :key="`${entry.role}-${entry.id}`">
        <UserMessage
          v-if="entry.role === 'user'"
          :text="entry.text"
          :name="userName"
        />
        <AgentMessage
          v-else
          :message="entry"
          @feedback="emit('feedback', entry.id, $event)"
        />
      </template>
      <div ref="bottom" />
    </div>
  </ScrollArea>
</template>
