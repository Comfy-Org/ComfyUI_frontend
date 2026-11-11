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
    v-if="!view.landed"
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
      v-if="view.ring"
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
    <div v-if="answers" class="flex items-center gap-2">
      <span
        class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-foreground"
      >
        {{ answers.number }}
      </span>
      <p class="m-0 truncate text-xs text-muted-foreground">
        {{ messages.answersComment(answers.label) }}
      </p>
    </div>
    <p v-if="replay" class="m-0 text-xs text-muted-foreground">
      {{ messages.replayHint }}
    </p>
    <ThreadHistory v-if="thread && thread.length > 0" :thread />
    <div class="flex items-start gap-2">
      <p class="m-0 flex-1 whitespace-pre-line">{{ step.text }}</p>
      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="messages.close"
        @click="emit('close')"
      >
        <i class="icon-[lucide--x] size-3" aria-hidden="true" />
      </Button>
    </div>
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
    <div v-if="step.offerEdit || isLast || !step.waitFor" class="flex gap-2">
      <Button
        v-if="step.offerEdit"
        variant="primary"
        :disabled="isHeld"
        @click="emit('applyEdit')"
      >
        {{ messages.doItForMe }}
      </Button>
      <Button v-if="isLast" :disabled="isHeld" @click="emit('done')">
        {{ messages.done }}
      </Button>
      <Button
        v-else-if="!step.waitFor"
        :disabled="isHeld"
        @click="emit('next')"
      >
        {{ messages.next }}
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
    <p class="m-0 text-xs text-muted-foreground">
      {{ messages.stepOf(index + 1, total) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

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
  replay = false,
  avoid = null
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
  replay?: boolean
  /** A rect the bubble should not sit under, when another side is free. */
  avoid?: Rect | null
}>()

const emit = defineEmits<{
  applyEdit: []
  next: []
  done: []
  close: []
  followUp: [text: string]
  cancelFollowUp: []
  retryFollowUp: []
}>()

const bubble = useTemplateRef('bubble')
const bubbleSize = useElementSize(bubble, undefined, { box: 'border-box' })
const windowSize = useWindowSize()

const isLast = computed(() => index === total - 1)
const isHeld = computed(() => followUp?.status === 'waiting')

const placement = computed(() =>
  placeAttached(
    view.ring ?? { ...view.pointer, width: 0, height: 0 },
    { width: bubbleSize.width.value, height: bubbleSize.height.value },
    { width: windowSize.width.value, height: windowSize.height.value },
    step.target?.kind === 'control' ? UNDER_CONTROL : BESIDE_TARGET,
    avoid
  )
)

const TAIL_BORDERS: Record<Side, string> = {
  right: 'border-b border-l',
  left: 'border-t border-r',
  below: 'border-t border-l',
  above: 'border-b border-r'
}

const tail = computed(() => {
  const { side, tail: offset } = placement.value
  const at = `${offset}px`
  const style = {
    right: { left: '0', top: at },
    left: { left: '100%', top: at },
    below: { left: at, top: '0' },
    above: { left: at, top: '100%' }
  }[side]
  return { classes: TAIL_BORDERS[side], style }
})
</script>
