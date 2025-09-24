<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

interface Props {
  index: number
  selected: boolean
  imageSrc: string
  name: string
  metadata?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: [index: number]
  imageLoad: [event: Event]
}>()

const actualDimensions = ref<string | null>(null)

function handleClick() {
  emit('click', props.index)
}

function handleImageLoad(event: Event) {
  emit('imageLoad', event)
  if (!event.target || !(event.target instanceof HTMLImageElement)) return
  const img = event.target
  if (img.naturalWidth && img.naturalHeight) {
    actualDimensions.value = `${img.naturalWidth} x ${img.naturalHeight}`
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-1 text-center select-none group/item cursor-pointer"
    @click="handleClick"
  >
    <!-- Image -->
    <div
      :class="
        cn(
          'relative',
          'aspect-square w-full overflow-hidden rounded-sm outline-1 outline-offset-[-1px] outline-zinc-300/10',
          'transition-all duration-150',
          'group-hover/item:scale-108',
          'group-active/item:scale-95',
          // selection
          !!selected && 'ring-2 ring-blue-500'
        )
      "
    >
      <!-- Selected Icon -->
      <div
        v-if="selected"
        class="rounded-full bg-blue-500 border-1 border-white size-4 absolute top-1 left-1"
      >
        <i-lucide:check class="size-3 text-white -translate-y-[0.5px]" />
      </div>
      <img
        :src="imageSrc"
        class="size-full object-cover"
        @load="handleImageLoad"
      />
    </div>
    <!-- Name -->
    <span
      :class="
        cn(
          'block text-[15px] line-clamp-2 wrap-break-word',
          'transition-colors duration-150',
          // selection
          !!selected && 'text-blue-500'
        )
      "
    >
      {{ name }}
    </span>
    <!-- Meta Data -->
    <span class="block text-xs text-slate-400">{{
      metadata || actualDimensions
    }}</span>
  </div>
</template>
