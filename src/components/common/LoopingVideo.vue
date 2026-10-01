<template>
  <div v-if="webmSrc && !failed" class="relative">
    <video
      ref="video"
      v-bind="$attrs"
      :poster="posterSrc || undefined"
      :autoplay="motionAllowed"
      muted
      loop
      playsinline
      @play="playing = true"
      @pause="playing = false"
      @error="failed = true"
    >
      <source :src="webmSrc" type="video/webm" @error="failed = !mp4Src" />
      <source
        v-if="mp4Src"
        :src="mp4Src"
        type="video/mp4"
        @error="failed = true"
      />
    </video>
    <Button
      v-if="pausable"
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
  webmSrc = '',
  mp4Src = '',
  posterSrc = '',
  pausable = false
} = defineProps<{
  webmSrc?: string
  mp4Src?: string
  posterSrc?: string
  pausable?: boolean
}>()

defineOptions({ inheritAttrs: false })

const video = useTemplateRef('video')
const failed = ref(false)
const playing = ref(false)

const reducedMotion = usePreferredReducedMotion()
const motionAllowed = computed(() => reducedMotion.value !== 'reduce')

watchEffect(() => {
  if (!motionAllowed.value) video.value?.pause()
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
