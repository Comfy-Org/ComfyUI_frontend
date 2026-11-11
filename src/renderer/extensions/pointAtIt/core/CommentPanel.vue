<template>
  <section
    data-testid="point-at-it-panel"
    :aria-label="messages.trayTitle"
    class="flex flex-col gap-2 overflow-y-auto rounded-lg border border-solid border-border bg-background p-3 text-xs shadow-md"
  >
    <div class="flex items-center gap-2">
      <span class="flex-1 font-medium">{{ messages.trayTitle }}</span>
      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="messages.hidePanel"
        @click="emit('collapse')"
      >
        <i class="icon-[lucide--chevron-up] size-3" aria-hidden="true" />
      </Button>
    </div>
    <p v-if="hint" class="m-0 text-muted-foreground">{{ hint }}</p>
    <TrayComments
      :comments="unsentComments"
      :pins
      :disabled="!canEdit"
      @open="(id) => emit('open', id)"
    />
    <div
      v-if="phase === 'waiting'"
      role="status"
      class="flex items-center gap-2 text-muted-foreground"
    >
      <i
        class="icon-[lucide--loader-circle] motion-safe:animate-spin"
        aria-hidden="true"
      />
      <span class="flex-1">{{ messages.waiting(elapsedSeconds) }}</span>
      <Button size="sm" @click="emit('cancel')">{{ messages.cancel }}</Button>
    </div>
    <div v-if="thinking" class="flex flex-col gap-1">
      <p
        v-if="thinking.done && !thinking.text"
        class="m-0 text-muted-foreground"
      >
        {{ messages.noThinking }}
      </p>
      <template v-else>
        <Button
          variant="textonly"
          size="unset"
          class="justify-start gap-1 self-start rounded-sm px-1 text-muted-foreground"
          :aria-label="
            thinkingOpen ? messages.hideThinking : messages.showThinking
          "
          :aria-expanded="thinkingOpen"
          @click="thinkingOpen = !thinkingOpen"
        >
          <i :class="chevron(thinkingOpen)" aria-hidden="true" />
          {{ messages.thinking }}
        </Button>
        <p
          v-if="thinkingOpen"
          role="log"
          tabindex="0"
          :aria-label="messages.thinking"
          class="m-0 max-h-40 overflow-y-auto rounded-md bg-secondary p-2 whitespace-pre-wrap text-muted-foreground"
        >
          {{ thinking.text }}
        </p>
        <p
          v-else-if="phase === 'waiting' && thinking.text"
          role="log"
          :aria-label="messages.thinking"
          class="m-0 line-clamp-2 text-muted-foreground"
        >
          {{ thinkingTail }}
        </p>
      </template>
    </div>
    <div v-if="failure" role="alert" class="flex items-start gap-2">
      <span class="flex-1 wrap-break-word text-destructive">
        {{ describeFailure(failure) }}
      </span>
      <Button size="sm" @click="emit('retry')">{{ messages.retry }}</Button>
    </div>
    <p
      v-if="sendBlock && phase !== 'waiting' && conversation.unsent.length > 0"
      role="status"
      class="m-0 text-muted-foreground"
    >
      {{ sendBlock }}
    </p>
    <div
      v-if="confirmsStartOver"
      role="group"
      :aria-label="messages.startOver"
      class="flex items-center gap-2"
    >
      <span class="flex-1">{{ messages.startOverQuestion }}</span>
      <Button size="sm" variant="destructive" @click="startOver">
        {{ messages.startOverConfirm }}
      </Button>
      <Button size="sm" @click="confirmsStartOver = false">
        {{ messages.startOverKeep }}
      </Button>
    </div>
    <div v-else class="flex items-center gap-2">
      <Button
        v-if="conversation.turns.length > 0"
        size="sm"
        variant="muted-textonly"
        :disabled="phase === 'waiting' || held"
        @click="confirmsStartOver = true"
      >
        {{ messages.startOver }}
      </Button>
      <span class="flex-1" />
      <Button
        size="sm"
        :disabled="!canEdit || conversation.unsent.length === 0"
        @click="emit('clear')"
      >
        {{ messages.clear }}
      </Button>
      <Button
        size="sm"
        variant="primary"
        :disabled="!canEdit || conversation.unsent.length === 0"
        @click="emit('send')"
      >
        {{ messages.send(conversation.unsent.length) }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { computed, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { describeFailure, messages } from './messages'
import type { PointState, RequestFailure } from './pointState'
import type { ThinkingLog } from './thinkingLog'
import TrayComments from './TrayComments.vue'
import { numberedComments } from './turns'
import type { Conversation } from './turns'
import type { PinView } from './usePointSession'

const TAIL_CHARS = 160

const {
  conversation,
  pins,
  phase,
  waitingSince,
  failure,
  thinking,
  sendBlock = '',
  held = false
} = defineProps<{
  conversation: Conversation
  pins: PinView[]
  phase: PointState['phase']
  waitingSince: number | null
  failure: RequestFailure | null
  thinking: ThinkingLog | null
  /** Why Send is unavailable right now; empty when it is available. */
  sendBlock?: string
  /** True while a follow-up waits for its reply and holds everything else. */
  held?: boolean
}>()

const emit = defineEmits<{
  collapse: []
  open: [annotationId: string]
  send: []
  clear: []
  startOver: []
  cancel: []
  retry: []
}>()

const now = useTimestamp({ interval: 500 })
const thinkingOpen = ref(false)
const confirmsStartOver = ref(false)

const unsentComments = computed(() =>
  numberedComments(conversation).filter((comment) => comment.turn === null)
)
const canEdit = computed(
  () => phase === 'idle' || phase === 'annotating' || phase === 'failed'
)
const elapsedSeconds = computed(() =>
  waitingSince === null
    ? 0
    : Math.max(0, Math.floor((now.value - waitingSince) / 1000))
)
const hint = computed(() => {
  if (phase === 'annotating') return messages.annotateHint
  return conversation.turns.length === 0 &&
    conversation.unsent.length === 0 &&
    phase === 'idle'
    ? messages.noCommentsYet
    : ''
})
const thinkingTail = computed(() => {
  const text = thinking?.text.trim() ?? ''
  return text.length > TAIL_CHARS ? `…${text.slice(-TAIL_CHARS)}` : text
})

function chevron(open: boolean): string {
  return cn(
    'size-3',
    open ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-right]'
  )
}

function startOver() {
  confirmsStartOver.value = false
  emit('startOver')
}
</script>
