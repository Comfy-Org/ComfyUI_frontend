<script setup lang="ts">
import { X } from '@lucide/vue'
import { nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Corner, Rect } from '@/lib/workshop/move-anything/arrange'
import { nudgeFor } from '@/lib/workshop/nudge'
import { rectStyle } from '@/components/workshop/app-editor/stage-geometry'

const {
  rect,
  n,
  label,
  description,
  labels,
  selected,
  outlined = false
} = defineProps<{
  rect: Rect
  n: number
  label: string
  description: string
  labels: { rename: string; remove: string; hint: string }
  selected: boolean
  /** Drawn by its outline; the box only holds the tag and handles. */
  outlined?: boolean
}>()

const emit = defineEmits<{
  grab: [event: PointerEvent, corner?: Corner]
  nudge: [dx: number, dy: number]
  select: []
  rename: [label: string]
  remove: []
}>()

const DOUBLE_PRESS_MS = 400

const CORNERS: readonly { corner: Corner; place: string }[] = [
  { corner: 'nw', place: '-top-1 -left-1 cursor-nwse-resize' },
  { corner: 'ne', place: '-top-1 -right-1 cursor-nesw-resize' },
  { corner: 'sw', place: '-bottom-1 -left-1 cursor-nesw-resize' },
  { corner: 'se', place: '-right-1 -bottom-1 cursor-nwse-resize' }
]

const box = useTemplateRef<HTMLButtonElement>('box')
const field = useTemplateRef<HTMLInputElement>('field')
const editing = ref(false)
let lastPress = -Infinity

function pressChip(event: PointerEvent) {
  if (event.timeStamp - lastPress < DOUBLE_PRESS_MS) {
    event.preventDefault()
    lastPress = -Infinity
    void startRename()
    return
  }
  lastPress = event.timeStamp
  emit('grab', event)
}

async function startRename() {
  emit('select')
  editing.value = true
  await nextTick()
  field.value?.select()
}

function finish(save: boolean) {
  if (!editing.value) return
  editing.value = false
  if (save && field.value) emit('rename', field.value.value)
  box.value?.focus()
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    emit('remove')
    return
  }
  if (event.key === 'F2') {
    event.preventDefault()
    void startRename()
    return
  }
  const step = nudgeFor(event)
  if (!step) return
  event.preventDefault()
  emit('nudge', step[0], step[1])
}
</script>

<template>
  <div class="absolute" :style="rectStyle(rect)">
    <button
      ref="box"
      type="button"
      :aria-label="description"
      :aria-pressed="selected"
      :class="
        cn(
          'absolute inset-0 cursor-move touch-none rounded-sm border-[1.5px] focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
          outlined
            ? cn(
                'border-dashed',
                selected
                  ? 'border-primary-comfy-yellow/40'
                  : 'border-transparent'
              )
            : selected
              ? 'border-primary-comfy-yellow'
              : 'border-primary-warm-white/90'
        )
      "
      @pointerdown="emit('grab', $event)"
      @keydown="onKey"
      @focus="emit('select')"
    >
      <template v-if="selected">
        <span
          v-for="handle in CORNERS"
          :key="handle.corner"
          :class="
            cn(
              'absolute size-2 rounded-xs border-[1.5px] border-primary-comfy-yellow bg-primary-comfy-ink',
              handle.place
            )
          "
          aria-hidden="true"
          @pointerdown.stop="emit('grab', $event, handle.corner)"
        />
      </template>
    </button>
    <span
      :class="
        cn(
          'absolute -top-5.5 -left-px flex h-4.5 cursor-move items-center gap-1 rounded-sm pl-0.5 text-[10px] font-medium whitespace-nowrap text-primary-comfy-ink',
          selected
            ? 'bg-primary-comfy-yellow pr-0.5'
            : 'bg-primary-warm-white/90 pr-1.5'
        )
      "
      :title="labels.hint"
      data-testid="move-object-chip"
      @pointerdown="pressChip"
    >
      <span
        class="flex size-3.5 items-center justify-center rounded-sm bg-primary-comfy-ink text-[9px] text-primary-warm-white"
        aria-hidden="true"
        >{{ n }}</span
      >
      <input
        v-if="editing"
        ref="field"
        :value="label"
        :aria-label="labels.rename"
        class="h-3.5 w-24 rounded-xs bg-primary-comfy-ink/10 px-0.5 text-[10px] text-primary-comfy-ink focus-visible:outline-none"
        @pointerdown.stop
        @keydown.enter.prevent="finish(true)"
        @keydown.esc.prevent="finish(false)"
        @blur="finish(true)"
      />
      <span v-else aria-hidden="true">{{ label }}</span>
      <button
        v-if="selected && !editing"
        type="button"
        :aria-label="labels.remove"
        class="flex size-3.5 items-center justify-center rounded-xs hover:bg-primary-comfy-ink/15 focus-visible:ring-2 focus-visible:ring-primary-comfy-ink/50 focus-visible:outline-none"
        @pointerdown.stop
        @click="emit('remove')"
      >
        <X class="size-2.5" aria-hidden="true" />
      </button>
    </span>
  </div>
</template>
