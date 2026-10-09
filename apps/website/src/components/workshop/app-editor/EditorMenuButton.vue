<script setup lang="ts" generic="T extends string">
import { ChevronDown, Plus } from '@lucide/vue'
import { onClickOutside } from '@vueuse/core'
import type { Component } from 'vue'
import { ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  items,
  icon = Plus,
  iconOnly = false,
  disabled = false,
  up = false,
  end = false,
  detached = false
} = defineProps<{
  label: string
  items: readonly {
    id: T
    label: string
    icon: Component
    disabled?: boolean
  }[]
  icon?: Component
  iconOnly?: boolean
  disabled?: boolean
  /** Opens the menu above the button, for a button low on the screen. */
  up?: boolean
  /** Lines the menu up with the button's right edge. */
  end?: boolean
  /** Opens the menu against the nearest positioned ancestor instead. */
  detached?: boolean
}>()

const emit = defineEmits<{ pick: [id: T] }>()
const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
onClickOutside(root, () => (open.value = false))

function pick(id: T) {
  open.value = false
  emit('pick', id)
}
</script>

<template>
  <div
    ref="root"
    :class="cn(!detached && 'relative')"
    @keydown.esc="open = false"
  >
    <button
      type="button"
      :aria-expanded="open"
      :aria-label="iconOnly ? label : undefined"
      :title="iconOnly ? label : undefined"
      :disabled
      :class="
        cn(
          'flex h-8 items-center justify-center gap-1.5 rounded-full text-xs text-primary-warm-white transition hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent',
          iconOnly ? 'w-8' : 'px-3 max-sm:px-2'
        )
      "
      @click="open = !open"
    >
      <component :is="icon" class="size-3.5" aria-hidden="true" />
      <template v-if="!iconOnly">
        <span class="max-sm:sr-only">{{ label }}</span>
        <ChevronDown
          class="size-3 text-primary-warm-gray max-sm:hidden"
          aria-hidden="true"
        />
      </template>
    </button>
    <div
      v-if="open"
      role="group"
      :aria-label="label"
      :class="
        cn(
          'absolute z-30 flex min-w-40 flex-col rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light p-1 shadow-xl shadow-black/40',
          up ? 'bottom-full mb-2' : 'top-full mt-1',
          end ? 'right-0' : 'left-0'
        )
      "
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        :disabled="item.disabled"
        class="flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-xs text-primary-warm-white transition hover:bg-transparency-white-t8 focus-visible:bg-transparency-white-t8 focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
        @click="pick(item.id)"
      >
        <component
          :is="item.icon"
          class="size-3.5 text-primary-warm-gray"
          aria-hidden="true"
        />
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
