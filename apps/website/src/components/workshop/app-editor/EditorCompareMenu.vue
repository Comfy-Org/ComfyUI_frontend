<script setup lang="ts" generic="T extends string">
import { Check, ChevronDown, Columns2 } from '@lucide/vue'
import { onClickOutside } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  items,
  hold,
  hint,
  shown,
  disabled = false
} = defineProps<{
  label: string
  items: readonly { id: T; label: string }[]
  /** The view shown while the button is pressed and held. */
  hold: T
  hint: string
  /** The view the button counts as at rest; any other reads as pressed. */
  shown: T
  disabled?: boolean
}>()

const value = defineModel<T>({ required: true })
const HOLD_MS = 250
const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
let timer: ReturnType<typeof setTimeout> | undefined
let before: T | undefined
let held = false
onClickOutside(root, () => (open.value = false))

function press(event: PointerEvent) {
  held = false
  if (disabled || event.button !== 0) return
  timer = setTimeout(() => {
    timer = undefined
    held = true
    before = value.value
    value.value = hold
  }, HOLD_MS)
}

function release() {
  clearTimeout(timer)
  timer = undefined
  if (before === undefined) return
  value.value = before
  before = undefined
}

function click() {
  if (held) held = false
  else open.value = !open.value
}

function pick(id: T) {
  value.value = id
  open.value = false
}
</script>

<template>
  <div ref="root" class="relative" @keydown.esc="open = false">
    <button
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="label"
      :title="hint"
      :disabled
      :class="
        cn(
          'flex h-8 shrink-0 touch-none items-center gap-1.5 rounded-full px-3 text-xs text-primary-warm-gray transition select-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40 max-sm:px-2',
          value !== shown && 'bg-transparency-white-t20 text-primary-warm-white'
        )
      "
      @pointerdown="press"
      @pointerup="release"
      @pointerleave="release"
      @pointercancel="release"
      @contextmenu.prevent
      @click="click"
    >
      <Columns2 class="size-3.5" aria-hidden="true" />
      <span class="max-sm:sr-only">{{ label }}</span>
      <ChevronDown class="size-3 max-sm:hidden" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      role="menu"
      :aria-label="label"
      class="absolute right-0 bottom-full z-30 mb-2 flex min-w-40 flex-col rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light p-1 shadow-xl shadow-black/40"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        role="menuitemradio"
        :aria-checked="value === item.id"
        class="flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-xs text-primary-warm-white transition hover:bg-transparency-white-t8 focus-visible:bg-transparency-white-t8 focus-visible:outline-none"
        @click="pick(item.id)"
      >
        <Check
          :class="cn('size-3.5', value !== item.id && 'invisible')"
          aria-hidden="true"
        />
        {{ item.label }}
      </button>
      <p class="px-2.5 pt-1 pb-1.5 text-[11px] text-primary-warm-gray">
        {{ hint }}
      </p>
    </div>
  </div>
</template>
