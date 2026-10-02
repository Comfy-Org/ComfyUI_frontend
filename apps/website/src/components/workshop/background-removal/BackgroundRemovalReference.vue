<script setup lang="ts">
import { Plus, X } from '@lucide/vue'
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { url, label, removeLabel } = defineProps<{
  url?: string
  label: string
  removeLabel: string
}>()
const emit = defineEmits<{ pick: [file: File | undefined] }>()

const input = useTemplateRef<HTMLInputElement>('input')

function choose(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const [picked] = target.files ?? []
  if (picked?.type.startsWith('image/')) emit('pick', picked)
  target.value = ''
}

function drop(event: DragEvent) {
  const [picked] = event.dataTransfer?.files ?? []
  if (picked?.type.startsWith('image/')) emit('pick', picked)
}
</script>

<template>
  <div class="relative shrink-0" @dragover.prevent @drop.prevent="drop">
    <button
      type="button"
      :aria-label="label"
      :title="label"
      :class="
        cn(
          'grid size-9 place-items-center overflow-hidden rounded-lg border border-dashed border-transparency-white-t20 text-primary-comfy-canvas outline-none hover:border-primary-warm-white/50 hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-40',
          url && 'border-solid'
        )
      "
      @click="input?.click()"
    >
      <img v-if="url" :src="url" alt="" class="size-full object-cover" />
      <Plus v-else class="size-4" aria-hidden="true" />
    </button>
    <button
      v-if="url"
      type="button"
      class="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary-warm-white text-primary-comfy-ink hover:bg-primary-comfy-yellow"
      :aria-label="removeLabel"
      @click="emit('pick', undefined)"
    >
      <X class="size-2.5" aria-hidden="true" />
    </button>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      data-testid="background-removal-reference"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="choose"
    />
  </div>
</template>
