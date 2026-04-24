<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { src, clipId, objectPosition } = defineProps<{
  src: string
  clipId: string
  objectPosition?: 'top' | 'bottom' | 'center'
}>()

const positionClass = {
  top: 'object-top',
  bottom: 'object-bottom',
  center: 'object-center'
} as const

function isVideo(url: string): boolean {
  return url.endsWith('.webm')
}
</script>

<template>
  <div
    class="relative size-full overflow-hidden"
    :style="`clip-path: url(#${clipId})`"
  >
    <Transition name="crossfade">
      <video
        v-if="isVideo(src)"
        :key="`video-${src}`"
        :src
        :poster="src.replace('.webm', '.webp')"
        autoplay
        muted
        loop
        playsinline
        :controls="false"
        disablepictureinpicture
        aria-hidden="true"
        :class="
          cn(
            'absolute inset-0 size-full object-cover',
            objectPosition && positionClass[objectPosition]
          )
        "
      />
      <img
        v-else
        :key="`img-${src}`"
        :src
        alt=""
        aria-hidden="true"
        :class="
          cn(
            'absolute inset-0 size-full object-cover',
            objectPosition && positionClass[objectPosition]
          )
        "
      />
    </Transition>
  </div>
</template>
