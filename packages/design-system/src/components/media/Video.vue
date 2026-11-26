<template>
  <div v-if="showsVideo" class="relative grid">
    <video
      ref="video"
      v-bind="attrsWithoutClass"
      :class="cn('col-start-1 row-start-1', attrsClass)"
      :poster="posterSrc || undefined"
      :autoplay="shouldAutoplay"
      :muted
      :loop
      :playsinline="playsInline"
      @play="playing = true"
      @pause="playing = false"
      @timeupdate="noteFramePlayed"
      @error="failed = true"
    >
      <source
        v-for="(source, index) in sources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
        @error="noteSourceFailed(index)"
      />
    </video>
    <img
      v-if="showsPoster"
      :src="posterSrc"
      alt=""
      :class="cn('pointer-events-none col-start-1 row-start-1', attrsClass)"
    />
    <Button
      v-if="playbackLabels"
      variant="overlay-white"
      size="icon"
      class="absolute right-3 bottom-3"
      :aria-label="playing ? playbackLabels.pause : playbackLabels.play"
      @click="togglePlayback"
    >
      <i :class="playbackIcon" aria-hidden="true" />
    </Button>
  </div>
  <slot v-else name="fallback" />
</template>

<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'
import { useAttrsClass } from '@comfyorg/design-system/lib/composables/useAttrsClass'

const {
  sources = [],
  posterSrc = '',
  autoplay = false,
  muted = false,
  loop = false,
  playsInline = false,
  playbackLabels
} = defineProps<{
  sources?: Array<{ src: string; type: string }>
  posterSrc?: string
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  playsInline?: boolean
  playbackLabels?: { play: string; pause: string }
}>()

defineOptions({ inheritAttrs: false })

const { attrsClass, attrsWithoutClass } = useAttrsClass()
const video = useTemplateRef('video')
const failed = ref(false)
const playing = ref(false)
const framePlayed = ref(false)

const reducedMotion = usePreferredReducedMotion()
const shouldAutoplay = computed(
  () => autoplay && reducedMotion.value !== 'reduce'
)

watchEffect(() => {
  if (autoplay && !shouldAutoplay.value) video.value?.pause()
})

const showsVideo = computed(() => sources.length > 0 && !failed.value)
const showsPoster = computed(() => !!posterSrc && !framePlayed.value)
const playbackIcon = computed(() =>
  playing.value ? 'icon-[lucide--pause]' : 'icon-[lucide--play]'
)

function noteSourceFailed(index: number) {
  failed.value = index === sources.length - 1
}

function noteFramePlayed() {
  framePlayed.value ||= (video.value?.currentTime ?? 0) > 0
}

function togglePlayback() {
  const element = video.value
  if (!element) return
  if (!element.paused) element.pause()
  else
    element.play().catch(() => {
      playing.value = false
    })
}
</script>
