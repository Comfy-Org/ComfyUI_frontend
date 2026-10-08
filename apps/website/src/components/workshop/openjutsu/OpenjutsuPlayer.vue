<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'

import type { SwapWindow } from '@/lib/workshop/openjutsu/clip'
import { loopSeek } from '@/lib/workshop/openjutsu/take'

/**
 * The video on the stage. Given a part, it starts there and loops inside it;
 * without one it plays whole. The default slot sits over the picture.
 */
const { src, part } = defineProps<{
  src?: string
  /** The part of the video to stay inside. */
  part?: SwapWindow
}>()

const player = useTemplateRef<HTMLVideoElement>('player')

function seekToStart() {
  if (player.value && part) player.value.currentTime = part.start
}
function keepInside() {
  const video = player.value
  if (!video) return
  const to = loopSeek(video.currentTime, part)
  if (to !== undefined) video.currentTime = to
}
watch(() => [part?.start, part?.seconds], seekToStart)
</script>

<template>
  <div
    class="relative mx-auto grid max-h-[48svh] w-full place-items-center overflow-hidden rounded-md bg-primary-comfy-ink ring-1 ring-transparency-white-t8"
  >
    <video
      ref="player"
      :key="src"
      :src
      controls
      playsinline
      loop
      class="max-h-[48svh] w-full object-contain"
      data-testid="openjutsu-player"
      @loadedmetadata="seekToStart"
      @timeupdate="keepInside"
    />
    <slot />
  </div>
</template>
