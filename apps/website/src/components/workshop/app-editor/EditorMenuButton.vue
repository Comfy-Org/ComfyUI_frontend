<script setup lang="ts" generic="T extends string">
import { Plus } from '@lucide/vue'
import { onClickOutside } from '@vueuse/core'
import type { Component } from 'vue'
import { ref, useTemplateRef } from 'vue'

const {
  label,
  items,
  disabled = false
} = defineProps<{
  label: string
  items: readonly { id: T; label: string; icon: Component }[]
  disabled?: boolean
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
  <div ref="root" class="relative" @keydown.esc="open = false">
    <button
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :disabled
      class="flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-primary-warm-white transition hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
      @click="open = !open"
    >
      <Plus class="size-3.5" aria-hidden="true" />
      {{ label }}
    </button>
    <div
      v-if="open"
      role="menu"
      :aria-label="label"
      class="absolute top-full left-0 z-30 mt-1 flex min-w-40 flex-col rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light p-1 shadow-xl shadow-black/40"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        role="menuitem"
        class="flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-xs text-primary-warm-white transition hover:bg-transparency-white-t8 focus-visible:bg-transparency-white-t8 focus-visible:outline-none"
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
