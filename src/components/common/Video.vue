<template>
  <div v-if="sources.length && !failed" class="relative">
    <video
      ref="video"
      v-bind="$attrs"
      :poster="posterSrc || undefined"
      :autoplay="shouldAutoplay"
      :muted
      :loop
      :playsinline="playsInline"
      @play="playing = true"
      @pause="playing = false"
      @error="failed = true"
    >
      <source
        v-for="(source, index) in sources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
        @error="failed = index === sources.length - 1"
      />
    </video>
    <Button
      v-if="playbackControl"
      variant="overlay-white"
      size="icon"
      class="absolute right-3 bottom-3"
      :aria-label="playing ? $t('g.pause') : $t('g.play')"
      @click="togglePlayback"
    >
      <i
        :class="playing ? 'icon-[lucide--pause]' : 'icon-[lucide--play]'"
        aria-hidden="true"
      />
    </Button>
  </div>
  <slot v-else name="fallback" />
</template>

<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const {
  sources = [],
  posterSrc = '',
  autoplay = false,
  muted = false,
  loop = false,
  playsInline = false,
  playbackControl = false
} = defineProps<{
  sources?: Array<{ src: string; type: string }>
  posterSrc?: string
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  playsInline?: boolean
  playbackControl?: boolean
}>()

defineOptions({ inheritAttrs: false })

const video = useTemplateRef('video')
const failed = ref(false)
const playing = ref(false)

const reducedMotion = usePreferredReducedMotion()
const shouldAutoplay = computed(
  () => autoplay && reducedMotion.value !== 'reduce'
)

watchEffect(() => {
  if (autoplay && !shouldAutoplay.value) video.value?.pause()
})

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
