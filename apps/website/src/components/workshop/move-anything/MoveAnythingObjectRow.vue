<script setup lang="ts">
import { X } from '@lucide/vue'
import { nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import type { MoveObject } from '../../../lib/workshop/move-anything/arrange'
import { isMoved } from '../../../lib/workshop/move-anything/arrange'
import { mc } from '../../../lib/workshop/move-anything/copy'

const {
  object,
  index,
  selected,
  locale = 'en'
} = defineProps<{
  object: MoveObject
  index: number
  selected: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  select: []
  remove: []
  rename: [label: string]
}>()

const editing = ref(false)
const field = useTemplateRef<HTMLInputElement>('field')

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
}
</script>

<template>
  <li
    :class="
      cn(
        'group flex h-9 items-center gap-2.5 rounded-lg pr-0.5 pl-2 transition',
        selected ? 'bg-transparency-white-t8' : 'hover:bg-transparency-white-t4'
      )
    "
  >
    <button
      type="button"
      :aria-pressed="selected"
      :aria-label="object.label"
      :class="
        cn(
          'flex size-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
          selected
            ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
            : 'bg-transparency-white-t20 text-primary-warm-white'
        )
      "
      @click="emit('select')"
    >
      {{ index + 1 }}
    </button>
    <input
      v-if="editing"
      ref="field"
      :value="object.label"
      :aria-label="mc('move.object.rename', locale, { label: object.label })"
      class="h-7 min-w-0 flex-1 rounded-md bg-transparency-white-t8 px-1.5 text-xs text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      @keydown.enter.prevent="finish(true)"
      @keydown.esc.prevent="finish(false)"
      @blur="finish(true)"
    />
    <button
      v-else
      type="button"
      :aria-label="mc('move.object.rename', locale, { label: object.label })"
      :title="mc('move.object.rename', locale, { label: object.label })"
      class="h-full min-w-0 flex-1 cursor-text truncate text-left text-xs text-primary-warm-white focus-visible:underline focus-visible:outline-none"
      @click="startRename"
    >
      {{ object.label }}
    </button>
    <span
      :class="
        cn(
          'text-[10px]',
          isMoved(object)
            ? 'text-primary-comfy-yellow'
            : 'text-primary-warm-gray'
        )
      "
      >{{
        mc(
          isMoved(object) ? 'move.object.moved' : 'move.object.inPlace',
          locale
        )
      }}</span
    >
    <button
      type="button"
      :aria-label="mc('move.object.remove', locale, { label: object.label })"
      :class="
        cn(
          'flex size-7 items-center justify-center rounded-full text-primary-warm-gray opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
          selected && 'opacity-100'
        )
      "
      @click="emit('remove')"
    >
      <X class="size-3" aria-hidden="true" />
    </button>
  </li>
</template>
