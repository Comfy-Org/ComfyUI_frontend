<template>
  <form
    ref="box"
    data-testid="point-at-it-comment-box"
    class="pointer-events-auto absolute flex w-80 flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3 shadow-md"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @submit.prevent="emit('save', text)"
  >
    <div class="flex items-start gap-2">
      <span class="flex-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
        {{ draft.label }}
      </span>
      <Button
        type="button"
        variant="textonly"
        size="icon-sm"
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
      @keydown.enter.exact="onEnter"
    />
    <div class="flex items-center gap-2">
      <Button type="submit" variant="primary" :disabled="!text.trim()">
        {{ messages.save }}
      </Button>
      <Button
        v-if="draft.annotationId"
        type="button"
        variant="destructive-textonly"
        @click="emit('remove')"
      >
        {{ messages.remove }}
      </Button>
    </div>
    <p class="m-0 text-xs text-muted-foreground">{{ messages.commentHint }}</p>
  </form>
</template>

<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { placeBeside } from './geometry'
import type { Rect } from './geometry'
import { messages } from './messages'
import type { Draft } from './pointState'

const {
  anchor,
  draft,
  targetNote = ''
} = defineProps<{
  anchor: Rect
  draft: Draft
  /** Says why the target cannot be shown, when it cannot. */
  targetNote?: string
}>()

const emit = defineEmits<{
  save: [comment: string]
  remove: []
  close: []
}>()

const text = ref(draft.comment)
const box = useTemplateRef('box')
const input = useTemplateRef('input')
const boxSize = useElementSize(box, undefined, { box: 'border-box' })
const windowSize = useWindowSize()

const position = computed(() =>
  placeBeside(
    anchor,
    { width: boxSize.width.value, height: boxSize.height.value },
    { width: windowSize.width.value, height: windowSize.height.value },
    ['right', 'left', 'below', 'above']
  )
)

function onEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  emit('save', text.value)
}

onMounted(() => input.value?.focus({ preventScroll: true }))
</script>
