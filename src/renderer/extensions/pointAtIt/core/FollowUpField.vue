<template>
  <div data-testid="point-at-it-follow-up" class="flex flex-col gap-1 text-xs">
    <template v-if="activity?.status === 'waiting'">
      <span class="text-muted-foreground">{{ messages.threadYou }}</span>
      <span class="wrap-break-word whitespace-pre-line">
        {{ activity.text }}
      </span>
      <div role="status" class="flex items-center gap-2 text-muted-foreground">
        <i
          class="icon-[lucide--loader-circle] motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span class="flex-1">
          {{ messages.followUpWaiting(elapsedSeconds) }}
        </span>
        <Button size="sm" @click="emit('cancel')">{{ messages.cancel }}</Button>
      </div>
      <p
        v-if="thinkingTail"
        role="log"
        :aria-label="messages.thinking"
        class="m-0 line-clamp-2 text-muted-foreground"
      >
        {{ thinkingTail }}
      </p>
    </template>
    <template v-else>
      <div v-if="activity" role="alert" class="flex items-start gap-2">
        <span class="flex-1 wrap-break-word text-destructive">
          {{ describeFailure(activity.failure) }}
        </span>
        <Button size="sm" @click="emit('retry')">{{ messages.retry }}</Button>
      </div>
      <textarea
        v-model="text"
        rows="1"
        class="resize-none rounded-md border border-border bg-transparent p-2 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        :aria-label="messages.followUpLabel"
        :placeholder="messages.followUpLabel"
        @keydown.enter="onEnter"
      />
      <p class="m-0 text-muted-foreground">
        {{ messages.followUpHint(sendKey) }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { computed, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { describeFailure, messages, sendNowKeyLabel } from './messages'
import type { FollowUpActivity } from './pointState'
import { takeEnter } from './textEntry'
import type { ThinkingLog } from './thinkingLog'

const TAIL_CHARS = 120

const { activity, thinking } = defineProps<{
  /** The follow-up that was sent from here and has no reply yet, if any. */
  activity: FollowUpActivity | null
  thinking: ThinkingLog | null
}>()

const emit = defineEmits<{
  send: [text: string]
  cancel: []
  retry: []
}>()

const sendKey = sendNowKeyLabel(navigator.userAgent)
const now = useTimestamp({ interval: 500 })
const text = ref(activity?.text ?? '')

const elapsedSeconds = computed(() =>
  activity?.status === 'waiting'
    ? Math.max(0, Math.floor((now.value - activity.startedAt) / 1000))
    : 0
)
const thinkingTail = computed(() => {
  if (activity?.status !== 'waiting') return ''
  if (thinking?.requestId !== activity.requestId) return ''
  const tail = thinking.text.trim()
  return tail.length > TAIL_CHARS ? `…${tail.slice(-TAIL_CHARS)}` : tail
})

function onEnter(event: KeyboardEvent) {
  const meaning = takeEnter(event)
  if (meaning !== 'enter' && meaning !== 'sendNow') return
  if (text.value.trim()) emit('send', text.value)
}
</script>
