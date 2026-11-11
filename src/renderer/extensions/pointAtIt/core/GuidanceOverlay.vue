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
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
  >
    <p v-if="answers" class="m-0 truncate text-xs text-muted-foreground">
      {{ messages.answersComment(answers.number, answers.label) }}
    </p>
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
        @click="emit('applyEdit')"
      >
        {{ messages.doItForMe }}
      </Button>
      <Button v-if="isLast" @click="emit('done')">
        {{ messages.done }}
      </Button>
      <Button v-else-if="!step.waitFor" @click="emit('next')">
        {{ messages.next }}
      </Button>
    </div>
    <p class="m-0 text-xs text-muted-foreground">
      {{ messages.stepOf(index + 1, total) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { placeBeside } from './geometry'
import type { Side } from './geometry'
import { messages } from './messages'
import type { GuidanceStep } from './replyValidation'
import type { GuidanceView } from './usePointSession'

const RING_OUTSET = 3
const BESIDE_TARGET: Side[] = ['right', 'left', 'below', 'above']
const UNDER_CONTROL: Side[] = ['below', 'left', 'above', 'right']

const { step, index, total, editFailed, view, answers } = defineProps<{
  step: GuidanceStep
  index: number
  total: number
  editFailed: boolean
  view: GuidanceView
  answers: { number: number; label: string } | null
}>()

const emit = defineEmits<{
  applyEdit: []
  next: []
  done: []
  close: []
}>()

const bubble = useTemplateRef('bubble')
const bubbleSize = useElementSize(bubble, undefined, { box: 'border-box' })
const windowSize = useWindowSize()

const isLast = computed(() => index === total - 1)

const position = computed(() =>
  placeBeside(
    view.ring ?? { ...view.pointer, width: 0, height: 0 },
    { width: bubbleSize.width.value, height: bubbleSize.height.value },
    { width: windowSize.width.value, height: windowSize.height.value },
    step.target?.kind === 'control' ? UNDER_CONTROL : BESIDE_TARGET
  )
)
</script>
