<script setup lang="ts">
import { vfxMediaRoot, vfxVariantMedia } from '@/data/vfxMedia'
import { computed } from 'vue'
import { prefersReducedMotion } from '@/composables/useReducedMotion'
import VideoCompareSlider from '@/components/common/VideoCompareSlider.vue'

const {
  source,
  variants,
  originalLabel,
  sliderLabel,
  choicesLabel,
  playbackIntent = 'auto'
} = defineProps<{
  source: string
  variants: { id: string; label: string }[]
  originalLabel: string
  sliderLabel: string
  choicesLabel: string
  playbackIntent?: 'auto' | 'play' | 'pause'
}>()
const selected = defineModel<string>('selected', { required: true })
const time = defineModel<number>('time', { required: true })
const paused = defineModel<boolean>('paused', { required: true })
const active = computed(
  () => variants.find((item) => item.id === selected.value) ?? variants[0]
)
const result = computed(() => vfxVariantMedia(active.value.id, 'mp4'))
function selectVariant(id: string) {
  selected.value = id
  paused.value =
    playbackIntent === 'pause' ||
    (playbackIntent === 'auto' && prefersReducedMotion())
}
</script>

<template>
  <div class="vfx-sample-scene">
    <VideoCompareSlider
      v-model:time="time"
      v-model:paused="paused"
      comparison-style="workflow"
      synchronized-playback
      follow-pointer-on-hover
      fit="cover"
      :before-src="`${vfxMediaRoot}/${source}.mp4`"
      :after-src="result"
      :before-poster-src="`${vfxMediaRoot}/${source}.jpg`"
      :after-poster-src="vfxVariantMedia(active.id, 'jpg')"
      :before-label="originalLabel"
      :slider-label="sliderLabel"
      :after-label="active.label"
      class="vfx-sample-result w-full overflow-hidden rounded-3xl"
    />
    <div class="vfx-sample-choices" role="group" :aria-label="choicesLabel">
      <button
        v-for="variant in variants"
        :key="variant.id"
        type="button"
        :aria-pressed="selected === variant.id"
        :aria-label="variant.label"
        @click="selectVariant(variant.id)"
      >
        <img
          :src="vfxVariantMedia(variant.id, 'jpg')"
          alt=""
          width="128"
          height="72"
        />
        <span class="sr-only">{{ variant.label }}</span>
      </button>
    </div>
  </div>
</template>
