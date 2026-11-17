<template>
  <div
    v-if="view.ring"
    data-testid="point-at-it-ring"
    class="absolute rounded-md ring-2 ring-primary"
    :style="{
      left: `${view.ring.x - RING_OUTSET}px`,
      top: `${view.ring.y - RING_OUTSET}px`,
      width: `${view.ring.width + RING_OUTSET * 2}px`,
      height: `${view.ring.height + RING_OUTSET * 2}px`
    }"
  />
  <div
    v-if="showPointer && !view.landed"
    data-testid="point-at-it-pointer"
    class="absolute top-0 left-0 flex items-start gap-1"
    :style="{
      transform: `translate(${view.pointer.x}px, ${view.pointer.y}px)`
    }"
  >
    <i
      class="icon-[lucide--mouse-pointer-2] size-5 text-primary drop-shadow-md"
      aria-hidden="true"
    />
    <span
      class="mt-4 rounded-full bg-primary px-2 py-0.5 text-xs text-foreground"
    >
      {{ messages.agentTag }}
    </span>
  </div>
  <section
    ref="bubble"
    data-testid="point-at-it-bubble"
    class="pointer-events-auto absolute flex w-80 flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3 shadow-md"
    :style="{
      left: `${placement.position.x}px`,
      top: `${placement.position.y}px`
    }"
  >
    <span
      v-if="view.ring || attachTo"
      data-testid="point-at-it-tail"
      aria-hidden="true"
      :class="
        cn(
          'absolute size-2.5 -translate-1/2 rotate-45 border-solid border-border bg-background',
          tail.classes
        )
      "
      :style="tail.style"
    />
    <div class="flex items-center gap-2">
      <template v-if="answers">
        <span
          class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-foreground"
        >
          {{ answers.number }}
        </span>
        <p class="m-0 min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {{ messages.answersComment(answers.label) }}
        </p>
      </template>
      <span v-else class="flex-1" />
      <span
        v-if="total > 1"
        class="shrink-0 text-xs text-muted-foreground"
        :title="messages.stopHint"
      >
        {{ messages.stepOf(index + 1, total) }}
      </span>
      <Button
        v-if="isLast"
        size="sm"
        class="shrink-0"
        :disabled="isHeld"
        @click="emit('done')"
      >
        {{ messages.done }}
      </Button>
      <Button
        v-else-if="!step.waitFor"
        size="sm"
        class="shrink-0"
        :disabled="isHeld"
        @click="emit('next')"
      >
        {{ messages.next }}
      </Button>
    </div>
    <ThreadHistory v-if="thread && thread.length > 0" :thread />
    <p class="m-0 whitespace-pre-line">{{ step.text }}</p>
    <p
      v-for="problem in step.problems"
      :key="problem"
      role="alert"
      class="m-0 text-xs text-destructive"
    >
      {{ problem }}
    </p>
    <p v-if="editFailed" role="alert" class="m-0 text-xs text-destructive">
      {{ messages.editFailed }}
    </p>
    <div v-if="step.offerEdit" class="flex gap-2">
      <Button variant="primary" :disabled="isHeld" @click="emit('applyEdit')">
        {{ messages.doItForMe }}
      </Button>
    </div>
    <FollowUpField
      v-if="thread"
      :key="`${index}:${thread.length}`"
      :activity="followUp"
      :thinking
      @send="(text) => emit('followUp', text)"
      @cancel="emit('cancelFollowUp')"
      @retry="emit('retryFollowUp')"
    />
  </section>
</template>

<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, onBeforeUnmount, useTemplateRef, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { bubbleTail } from './bubbleTail'
import FollowUpField from './FollowUpField.vue'
import { placeAttached } from './geometry'
import type { Rect, Side } from './geometry'
import { messages } from './messages'
import type { FollowUpActivity } from './pointState'
import type { GuidanceStep } from './replyValidation'
import ThreadHistory from './ThreadHistory.vue'
import type { ThinkingLog } from './thinkingLog'
import type { ThreadMessage } from './turns'
import type { GuidanceView } from './usePointSession'

const RING_OUTSET = 3
const BESIDE_TARGET: Side[] = ['right', 'left', 'below', 'above']
const UNDER_CONTROL: Side[] = ['below', 'left', 'above', 'right']
/** At her head the card goes to her right, or above her when it is too tall for that. */
const BESIDE_HER: Side[] = ['right', 'above', 'left', 'below']

const {
  step,
  index,
  total,
  editFailed,
  view,
  answers,
  thread = null,
  followUp = null,
  thinking = null,
  avoid = null,
  attachTo = null,
  showPointer = true
} = defineProps<{
  step: GuidanceStep
  index: number
  total: number
  editFailed: boolean
  view: GuidanceView
  answers: { number: number; label: string } | null
  /**
   * What was said in the answered question's thread before this step; null
   * when the step answers no question, and then there is no follow-up field.
   */
  thread?: ThreadMessage[] | null
  followUp?: FollowUpActivity | null
  thinking?: ThinkingLog | null
  /** A rect the bubble should not sit under, when another side is free. */
  avoid?: Rect | null
  /**
   * Her head, when the step points at nothing and the answer is her reply: the
   * card is attached to it, with its tail, and not to a pointer in the air.
   * Without a ring this is what gives the card its place.
   */
  attachTo?: Rect | null
  /** Draw the pointer glyph on its flight; false when something else points. */
  showPointer?: boolean
}>()

const emit = defineEmits<{
  applyEdit: []
  next: []
  done: []
  followUp: [text: string]
  cancelFollowUp: []
  retryFollowUp: []
  /** Where the card is, for whatever should stay off it; null when it is gone. */
  placed: [card: Rect | null]
}>()

const bubble = useTemplateRef('bubble')
const bubbleSize = useElementSize(bubble, undefined, { box: 'border-box' })
const windowSize = useWindowSize()

const isLast = computed(() => index === total - 1)
const isHeld = computed(() => followUp?.status === 'waiting')

const sides = computed(() => {
  if (view.ring === null && attachTo !== null) return BESIDE_HER
  return step.target?.kind === 'control' ? UNDER_CONTROL : BESIDE_TARGET
})

const placement = computed(() =>
  placeAttached(
    view.ring ?? attachTo ?? { ...view.pointer, width: 0, height: 0 },
    { width: bubbleSize.width.value, height: bubbleSize.height.value },
    { width: windowSize.width.value, height: windowSize.height.value },
    sides.value,
    avoid
  )
)

watch(
  () => ({
    x: placement.value.position.x,
    y: placement.value.position.y,
    width: bubbleSize.width.value,
    height: bubbleSize.height.value
  }),
  (card) => emit('placed', card),
  { immediate: true }
)
onBeforeUnmount(() => emit('placed', null))

const tail = computed(() =>
  bubbleTail(placement.value.side, placement.value.tail)
)
</script>
