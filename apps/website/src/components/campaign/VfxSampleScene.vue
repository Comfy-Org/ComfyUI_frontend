<script setup lang="ts">
import { vfxMediaRoot } from '@/data/vfxMedia'
import { computed } from 'vue'
import { prefersReducedMotion } from '@/composables/useReducedMotion'
import VideoCompareSlider from '@/components/common/VideoCompareSlider.vue'

const { variants, originalLabel, sliderLabel, choicesLabel } = defineProps<{
  variants: { id: string; label: string }[]
  originalLabel: string
  sliderLabel: string
  choicesLabel: string
}>()
const selected = defineModel<string>('selected', { required: true })
const time = defineModel<number>('time', { required: true })
const paused = defineModel<boolean>('paused', { required: true })
const active = computed(
  () => variants.find((item) => item.id === selected.value) ?? variants[0]
)
const source = `${vfxMediaRoot}/diner.mp4`
const result = computed(() => `${vfxMediaRoot}/${active.value.id}.mp4`)
function selectVariant(id: string) {
  selected.value = id
  paused.value = prefersReducedMotion()
}
</script>

<template>
  <div class="vfx-sample-scene">
    <VideoCompareSlider
      v-model:time="time"
      v-model:paused="paused"
      comparison-style="workflow"
      synchronized-playback
      fit="cover"
      :before-src="source"
      :after-src="result"
      :before-poster-src="`${vfxMediaRoot}/diner.jpg`"
      :after-poster-src="`${vfxMediaRoot}/${active.id}.jpg`"
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
          :src="`${vfxMediaRoot}/${variant.id}.jpg`"
          alt=""
          width="128"
          height="72"
        />
        <span class="sr-only">{{ variant.label }}</span>
      </button>
    </div>
  </div>
</template>
