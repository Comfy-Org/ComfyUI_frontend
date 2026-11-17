<template>
  <div data-testid="point-at-it-follow-up" class="flex flex-col gap-1 text-xs">
    <template v-if="activity?.status === 'waiting'">
      <span class="sr-only">{{ messages.threadYou }}</span>
      <span
        class="max-w-[85%] self-end rounded-lg bg-secondary px-3 py-1.5 text-sm wrap-break-word whitespace-pre-line"
      >
        {{ activity.text }}
      </span>
      <div role="status" class="flex items-start gap-2 text-muted-foreground">
        <i
          class="mt-0.5 icon-[lucide--loader-circle] motion-safe:animate-spin"
          aria-hidden="true"
        />
        <p
          v-if="thinkingTail"
          role="log"
          :aria-label="messages.thinking"
          class="m-0 line-clamp-2 flex-1"
        >
          {{ thinkingTail }}
        </p>
        <span v-else class="flex-1">{{ messages.followUpWaiting }}</span>
        <Button
          variant="muted-textonly"
          size="sm"
          class="shrink-0"
          @click="emit('cancel')"
        >
          {{ messages.cancel }}
        </Button>
      </div>
    </template>
    <template v-else>
      <div v-if="activity" role="alert" class="flex items-start gap-2">
        <span class="flex-1 wrap-break-word text-destructive">
          {{ describeFailure(activity.failure) }}
        </span>
        <Button size="sm" @click="emit('retry')">{{ messages.retry }}</Button>
      </div>
      <div
        class="flex items-end gap-2 rounded-xl border border-border bg-background py-1.5 pr-1.5 pl-3 focus-within:border-muted-foreground"
      >
        <textarea
          v-model="text"
          rows="1"
          class="field-sizing-content max-h-32 min-h-6 flex-1 resize-none border-none bg-transparent py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          :aria-label="messages.followUpLabel"
          :placeholder="messages.followUpLabel"
          @keydown.enter="onEnter"
        />
        <Button
          type="button"
          variant="primary"
          size="icon-sm"
          class="shrink-0 rounded-full"
          :aria-label="messages.followUpSend"
          :title="messages.followUpHint(sendKey)"
          :disabled="!text.trim()"
          @click="sendText"
        >
          <i class="icon-[lucide--arrow-up]" aria-hidden="true" />
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { describeFailure, messages, sendNowKeyLabel } from './messages'
import type { FollowUpActivity } from './pointState'
import { takeEnter } from './textEntry'
import type { ThinkingLog } from './thinkingLog'
import { latestThought } from './thoughtLine'

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
const text = ref(activity?.text ?? '')

const thinkingTail = computed(() => {
  if (activity?.status !== 'waiting') return ''
  if (thinking?.requestId !== activity.requestId) return ''
  return latestThought(thinking.text, { done: thinking.done })
})

function onEnter(event: KeyboardEvent) {
  const meaning = takeEnter(event)
  if (meaning !== 'enter' && meaning !== 'sendNow') return
  sendText()
}

function sendText() {
  if (text.value.trim()) emit('send', text.value)
}
</script>
