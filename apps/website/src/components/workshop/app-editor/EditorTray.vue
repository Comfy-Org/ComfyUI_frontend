<script setup lang="ts">
import { X } from '@lucide/vue'

const { title, closeLabel } = defineProps<{
  title: string
  closeLabel: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    role="dialog"
    :aria-label="title"
    class="pointer-events-auto w-full max-w-110 overflow-hidden rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light shadow-xl shadow-black/40"
    @keydown.esc="emit('close')"
  >
    <div
      class="flex h-10 items-center justify-between gap-2 border-b border-transparency-white-t8 pr-2 pl-3.5"
    >
      <span class="text-xs font-medium text-primary-warm-white">{{
        title
      }}</span>
      <span class="flex items-center gap-1.5">
        <slot name="actions" />
        <button
          type="button"
          :aria-label="closeLabel"
          class="flex size-7 items-center justify-center rounded-full text-primary-warm-gray hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          @click="emit('close')"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </span>
    </div>
    <div class="flex flex-col gap-2 p-2.5">
      <slot />
    </div>
  </div>
</template>
