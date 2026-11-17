<template>
  <form
    ref="box"
    data-testid="point-at-it-comment-box"
    class="pointer-events-auto absolute flex w-80 flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3 shadow-md"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @submit.prevent="emit('save', text)"
  >
    <div class="flex items-start gap-2">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="min-w-0 truncate text-sm font-medium text-foreground"
            :title="draft.label"
            data-testid="point-at-it-comment-target"
          >
            {{ summary }}
          </span>
          <Button
            v-if="manyTargets"
            type="button"
            variant="textonly"
            size="sm"
            class="shrink-0"
            :aria-expanded="listOpen"
            @click="listOpen = !listOpen"
          >
            {{ listOpen ? messages.hidePicked : messages.showPicked }}
          </Button>
        </div>
        <p
          v-if="manyTargets && listOpen"
          class="m-0 max-h-24 overflow-y-auto text-xs text-muted-foreground"
        >
          {{ draft.label }}
        </p>
      </div>
      <Button
        type="button"
        variant="textonly"
        size="icon-sm"
        class="shrink-0"
        :aria-label="messages.close"
        @click="emit('close')"
      >
        <i class="icon-[lucide--x] size-3" aria-hidden="true" />
      </Button>
    </div>
    <p v-if="targetNote" role="status" class="m-0 text-xs text-destructive">
      {{ targetNote }}
    </p>
    <textarea
      ref="input"
      v-model="text"
      rows="3"
      class="resize-none rounded-md border border-border bg-transparent p-2 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
      :aria-label="messages.commentLabel"
      :placeholder="messages.commentPlaceholder"
      @keydown.enter="onEnter"
    />
    <p v-if="notice" role="status" class="m-0 text-xs text-destructive">
      {{ notice }}
    </p>
    <div class="flex items-center gap-2">
      <p class="m-0 min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {{ messages.commentHint(sendKey) }}
      </p>
      <Button
        v-if="draft.annotationId"
        type="button"
        variant="destructive-textonly"
        class="shrink-0"
        @click="emit('remove')"
      >
        {{ messages.remove }}
      </Button>
      <Button
        type="submit"
        variant="primary"
        class="shrink-0"
        :disabled="!text.trim()"
      >
        {{ draft.annotationId ? messages.save : messages.add }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { placeBeside } from './geometry'
import type { Rect } from './geometry'
import { messages, sendNowKeyLabel } from './messages'
import type { Draft } from './pointState'
import { takeEnter } from './textEntry'

const {
  anchor,
  draft,
  unsentCount,
  sendBlock = '',
  avoid = null,
  targetNote = ''
} = defineProps<{
  anchor: Rect
  draft: Draft
  /** How many questions are already in the list, waiting to be sent. */
  unsentCount: number
  /** Why nothing can be sent right now; empty when it can. */
  sendBlock?: string
  /** A rect the box should not sit under, when another side is free. */
  avoid?: Rect | null
  /** Says why the target cannot be shown, when it cannot. */
  targetNote?: string
}>()

const emit = defineEmits<{
  save: [comment: string]
  /** Add what is typed, if anything, and send the whole list right away. */
  send: [comment: string]
  remove: []
  close: []
}>()

const sendKey = sendNowKeyLabel(navigator.userAgent)
const text = ref(draft.comment)
const listOpen = ref(false)
const notice = ref('')
const box = useTemplateRef('box')
const input = useTemplateRef('input')
const boxSize = useElementSize(box, undefined, { box: 'border-box' })
const windowSize = useWindowSize()

const manyTargets = computed(() => draft.targets.length > 1)
const summary = computed(() =>
  manyTargets.value ? messages.pickedCount(draft.targets.length) : draft.label
)

const position = computed(() =>
  placeBeside(
    anchor,
    { width: boxSize.width.value, height: boxSize.height.value },
    { width: windowSize.width.value, height: windowSize.height.value },
    ['right', 'left', 'below', 'above'],
    avoid
  )
)

function sendNow() {
  const hasSomething = text.value.trim() !== '' || unsentCount > 0
  notice.value = sendBlock || (hasSomething ? '' : messages.nothingToSend)
  if (!notice.value) emit('send', text.value)
}

function onEnter(event: KeyboardEvent) {
  const meaning = takeEnter(event)
  if (meaning === 'enter') emit('save', text.value)
  if (meaning === 'sendNow') sendNow()
}

onMounted(() => input.value?.focus({ preventScroll: true }))
</script>
