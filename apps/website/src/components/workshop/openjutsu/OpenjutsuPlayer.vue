<script setup lang="ts">
import VideoPlayer from '@/components/common/VideoPlayer.vue'
import type { Locale } from '@/i18n/translations'
import type { SwapWindow } from '@/lib/workshop/openjutsu/clip'
import { loopSeek } from '@/lib/workshop/openjutsu/take'

/**
 * The site's video player on the stage. Given a part, it starts there and
 * loops inside it; without one it plays whole. The default slot sits over
 * the picture, under the player's controls.
 */
const {
  src,
  part,
  label,
  locale = 'en'
} = defineProps<{
  src: string
  /** The part of the video to stay inside. */
  part?: SwapWindow
  label: string
  locale?: Locale
}>()

const emit = defineEmits<{ time: [video: HTMLVideoElement] }>()

function mainVideo(event: Event) {
  const { target } = event
  return target instanceof HTMLVideoElement &&
    target.dataset.overlay === undefined
    ? target
    : undefined
}

function seekToStart(event: Event) {
  const video = mainVideo(event)
  if (video && part) video.currentTime = part.start
}

function keepInside(event: Event) {
  const video = mainVideo(event)
  if (!video) return
  const to = loopSeek(video.currentTime, part)
  if (to !== undefined) video.currentTime = to
}

function report(event: Event) {
  const video = mainVideo(event)
  if (video) emit('time', video)
}
</script>

<template>
  <div
    class="size-full"
    @loadedmetadata.capture="seekToStart"
    @timeupdate.capture="
      (event: Event) => {
        keepInside(event)
        report(event)
      }
    "
    @play.capture="report"
    @pause.capture="report"
    @seeked.capture="report"
    @ratechange.capture="report"
  >
    <VideoPlayer
      :key="`${src}@${part?.start ?? 0}`"
      :src
      :locale
      :aria-label="label"
      class="aspect-auto size-full rounded-sm border-0"
      fit="contain"
      controls-on-hover
      autoplay
      loop
    >
      <slot />
    </VideoPlayer>
  </div>
</template>
