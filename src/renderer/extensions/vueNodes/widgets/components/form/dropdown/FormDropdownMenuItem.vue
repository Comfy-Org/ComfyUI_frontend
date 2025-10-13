<script setup lang="ts">
import { computed, inject, ref } from 'vue'

import LazyImage from '@/components/common/LazyImage.vue'
import { cn } from '@/utils/tailwindUtil'

import { AssetKindKey } from './types'
import type { LayoutMode } from './types'

interface Props {
  index: number
  selected: boolean
  mediaSrc: string
  name: string
  metadata?: string
  layout?: LayoutMode
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: [index: number]
  mediaLoad: [event: Event]
}>()

const actualDimensions = ref<string | null>(null)

const assetKind = inject(AssetKindKey)

const isVideo = computed(() => assetKind?.value === 'video')

function handleClick() {
  emit('click', props.index)
}

function handleImageLoad(event: Event) {
  emit('mediaLoad', event)
  if (!event.target || !(event.target instanceof HTMLImageElement)) return
  const img = event.target
  if (img.naturalWidth && img.naturalHeight) {
    actualDimensions.value = `${img.naturalWidth} x ${img.naturalHeight}`
  }
}

function handleVideoLoad(event: Event) {
  emit('mediaLoad', event)
  if (!event.target || !(event.target instanceof HTMLVideoElement)) return
  const video = event.target
  if (video.videoWidth && video.videoHeight) {
    actualDimensions.value = `${video.videoWidth} x ${video.videoHeight}`
  }
}
</script>

<template>
  <div
    :class="
      cn(
        'flex gap-1 select-none group/item cursor-pointer',
        'transition-all duration-150',
        {
          'flex-col text-center': layout === 'grid',
          'flex-row text-left max-h-16 bg-zinc-500/20 rounded-lg hover:scale-102 active:scale-98':
            layout === 'list',
          'flex-row text-left hover:bg-zinc-500/20 rounded-lg':
            layout === 'list-small',
          // selection
          'ring-2 ring-blue-500': layout === 'list' && selected
        }
      )
    "
    @click="handleClick"
  >
    <!-- Image -->
    <div
      v-if="layout !== 'list-small'"
      :class="
        cn(
          'relative',
          'w-full aspect-square overflow-hidden outline-1 outline-offset-[-1px] outline-zinc-300/10',
          'transition-all duration-150',
          {
            'min-w-16 max-w-16 rounded-l-lg': layout === 'list',
            'rounded-sm group-hover/item:scale-108 group-active/item:scale-95':
              layout === 'grid',
            // selection
            'ring-2 ring-blue-500': layout === 'grid' && selected
          }
        )
      "
    >
      <!-- Selected Icon -->
      <div
        v-if="selected"
        class="absolute top-1 left-1 size-4 rounded-full border-1 border-white bg-blue-500"
      >
        <i
          class="icon-[lucide--check] size-3 translate-y-[-0.5px] text-white"
        />
      </div>
      <video
        v-if="mediaSrc && isVideo"
        :src="mediaSrc"
        class="size-full object-cover"
        preload="metadata"
        muted
        @loadeddata="handleVideoLoad"
      />
      <LazyImage
        v-else-if="mediaSrc"
        :src="mediaSrc"
        :alt="name"
        image-class="size-full object-cover"
        @load="handleImageLoad"
      />
      <div
        v-else
        class="size-full bg-gradient-to-tr from-blue-400 via-teal-500 to-green-400"
      />
    </div>
    <!-- Name -->
    <div
      :class="
        cn('flex gap-1', {
          'flex-col': layout === 'grid',
          'flex-col px-4 py-1 w-full justify-center': layout === 'list',
          'flex-row p-2 items-center justify-between w-full':
            layout === 'list-small'
        })
      "
    >
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
  </div>
</template>
