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
  label?: string
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
        'group/item flex cursor-pointer gap-1 bg-component-node-widget-background select-none',
        'transition-all duration-150',
        {
          'flex-col text-center': layout === 'grid',
          'max-h-16 flex-row rounded-lg text-left hover:scale-102 active:scale-98':
            layout === 'list',
          'flex-row rounded-lg text-left hover:bg-component-node-widget-background-hovered':
            layout === 'list-small',
          // selection
          'ring-2 ring-component-node-widget-background-highlighted':
            layout === 'list' && selected
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
          'aspect-square w-full overflow-hidden outline-1 outline-offset-[-1px] outline-interface-stroke',
          'transition-all duration-150',
          {
            'max-w-16 min-w-16 rounded-l-lg': layout === 'list',
            'rounded-sm group-hover/item:scale-108 group-active/item:scale-95':
              layout === 'grid',
            // selection
            'ring-2 ring-component-node-widget-background-highlighted':
              layout === 'grid' && selected
          }
        )
      "
    >
      <!-- Selected Icon -->
      <div
        v-if="selected"
        class="absolute top-1 left-1 size-4 rounded-full border-1 border-base-foreground bg-primary-background"
      >
        <i
          class="bold icon-[lucide--check] size-3 translate-y-[-0.5px] text-base-foreground"
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
          'w-full min-w-0 flex-col justify-center px-4 py-1': layout === 'list',
          'w-full flex-row items-center justify-between p-2':
            layout === 'list-small'
        })
      "
    >
      <span
        v-tooltip="layout === 'grid' ? (label ?? name) : undefined"
        :class="
          cn(
            'line-clamp-2 block overflow-hidden text-xs break-words',
            'transition-colors duration-150',
            // selection
            !!selected && 'text-base-foreground'
          )
        "
      >
        {{ label ?? name }}
      </span>
      <!-- Meta Data -->
      <span class="text-secondary block text-xs">{{
        metadata || actualDimensions
      }}</span>
    </div>
  </div>
</template>
