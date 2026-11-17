<template>
  <section
    data-testid="point-at-it-panel"
    :aria-label="messages.trayTitle"
    class="flex max-h-80 flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3 text-xs shadow-md"
  >
    <div class="flex items-center gap-2">
      <span class="flex-1 font-medium">{{ messages.trayTitle }}</span>
      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="messages.hidePanel"
        @click="emit('collapse')"
      >
        <i class="icon-[lucide--chevron-down] size-3" aria-hidden="true" />
      </Button>
    </div>
    <div class="flex min-h-0 flex-col gap-2 overflow-y-auto">
      <p v-if="hint" class="m-0 text-muted-foreground">{{ hint }}</p>
      <TrayComments
        :comments="unsentComments"
        :pins
        :disabled="!canEdit"
        @open="(id) => emit('open', id)"
      />
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
import { computed, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { describeFailure, messages } from './messages'
import type { PointState, RequestFailure } from './pointState'
import TrayComments from './TrayComments.vue'
import { numberedComments } from './turns'
import type { Conversation } from './turns'
import type { PinView } from './usePointSession'

const {
  conversation,
  pins,
  phase,
  failure,
  sendBlock = '',
  held = false
} = defineProps<{
  conversation: Conversation
  pins: PinView[]
  phase: PointState['phase']
  failure: RequestFailure | null
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
  retry: []
}>()

const confirmsStartOver = ref(false)

const unsentComments = computed(() =>
  numberedComments(conversation).filter((comment) => comment.turn === null)
)
const canEdit = computed(
  () => phase === 'idle' || phase === 'annotating' || phase === 'failed'
)
const hint = computed(() => {
  if (phase === 'annotating') return messages.annotateHint
  return conversation.turns.length === 0 &&
    conversation.unsent.length === 0 &&
    phase === 'idle'
    ? messages.noCommentsYet
    : ''
})
function startOver() {
  confirmsStartOver.value = false
  emit('startOver')
}
</script>
