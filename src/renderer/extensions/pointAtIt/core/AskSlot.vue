<template>
  <div
    data-testid="point-at-it-slot"
    :data-kind="view.kind"
    class="flex flex-col items-start font-inter text-foreground"
  >
    <CommentPanel
      v-if="view.kind === 'questions'"
      class="w-full"
      :conversation
      :pins
      :phase
      :failure
      :send-block
      :held
      @collapse="emit('collapse')"
      @open="(id) => emit('open', id)"
      @send="emit('send')"
      @clear="emit('clear')"
      @start-over="emit('startOver')"
      @retry="emit('retry')"
    />
    <ThinkingDock
      v-else-if="view.kind === 'thinking' && thinking"
      class="w-full"
      :thinking
      :tall="view.tall"
      :cap
      :can-cancel="phase === 'waiting'"
      @collapse="emit('collapse')"
      @taller="emit('taller')"
      @cancel="emit('cancel')"
    />
    <div
      v-else-if="view.kind === 'failure' && failure"
      role="alert"
      :class="lineClass"
    >
      <span class="min-w-0 flex-1 truncate text-destructive" :title="sentence">
        {{ sentence }}
      </span>
      <Button size="sm" @click="emit('retry')">{{ messages.retry }}</Button>
    </div>
    <div
      v-else-if="view.kind === 'waiting'"
      role="status"
      class="w-full px-3 py-1.5 text-xs text-muted-foreground"
    >
      <span class="line-clamp-2">{{ waitingText }}</span>
    </div>
    <div
      v-else-if="view.kind === 'summary'"
      :class="cn(lineClass, 'w-auto gap-1.5 p-1')"
    >
      <Button class="h-7" size="sm" @click="emit('expand')">
        {{ messages.questionCount(conversation.unsent.length) }}
        <i class="icon-[lucide--chevron-up]" aria-hidden="true" />
      </Button>
      <Button class="h-7" size="sm" @click="emit('clear')">
        {{ messages.clear }}
      </Button>
      <Button class="h-7" size="sm" variant="primary" @click="emit('send')">
        {{ messages.send(conversation.unsent.length) }}
      </Button>
    </div>
    <p
      v-else-if="view.kind === 'hint'"
      role="status"
      :class="cn(lineClass, 'text-muted-foreground')"
    >
      {{ messages.annotateHint }}
    </p>
    <p
      v-else-if="view.kind === 'noThinking'"
      role="status"
      :class="cn(lineClass, 'text-muted-foreground')"
    >
      {{ messages.noThinking }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import CommentPanel from './CommentPanel.vue'
import { describeFailure, messages } from './messages'
import type { PointState, RequestFailure } from './pointState'
import type { SlotView } from './slotView'
import ThinkingDock from './ThinkingDock.vue'
import type { ThinkingLog } from './thinkingLog'
import { waitingLine } from './thoughtLine'
import type { Conversation } from './turns'
import type { PinView } from './usePointSession'

const lineClass =
  'm-0 flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs shadow-md'

const {
  view,
  thinking,
  failure,
  sendBlock = '',
  held = false
} = defineProps<{
  view: SlotView
  conversation: Conversation
  pins: PinView[]
  phase: PointState['phase']
  failure: RequestFailure | null
  thinking: ThinkingLog | null
  sendBlock?: string
  held?: boolean
  cap: number
}>()

const emit = defineEmits<{
  collapse: []
  expand: []
  open: [annotationId: string]
  send: []
  clear: []
  startOver: []
  cancel: []
  retry: []
  taller: []
}>()

const sentence = computed(() => (failure ? describeFailure(failure) : ''))
const waitingText = computed(() => waitingLine(thinking))
</script>
