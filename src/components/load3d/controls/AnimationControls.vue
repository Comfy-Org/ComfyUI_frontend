<template>
  <div
    v-if="animations && animations.length > 0"
    class="pointer-events-auto absolute top-0 left-0 z-10 flex w-full items-center justify-center gap-2 pt-2"
  >
    <Button
      size="icon"
      variant="textonly"
      class="rounded-full"
      :aria-label="$t('g.playPause')"
      @click="togglePlay"
    >
      <i
        :class="['pi', playing ? 'pi-pause' : 'pi-play', 'text-lg text-white']"
      />
    </Button>

    <Select
      v-model="selectedSpeed"
      :options="speedOptions"
      option-label="name"
      option-value="value"
      class="w-24"
    />

    <Select
      v-model="selectedAnimation"
      :options="animations"
      option-label="name"
      option-value="index"
      class="w-32"
    />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'

import Button from '@/components/ui/button/Button.vue'

type Animation = { name: string; index: number }

const animations = defineModel<Animation[]>('animations')
const playing = defineModel<boolean>('playing')
const selectedSpeed = defineModel<number>('selectedSpeed')
const selectedAnimation = defineModel<number>('selectedAnimation')

const speedOptions = [
  { name: '0.1x', value: 0.1 },
  { name: '0.5x', value: 0.5 },
  { name: '1x', value: 1 },
  { name: '1.5x', value: 1.5 },
  { name: '2x', value: 2 }
]

const togglePlay = () => {
  playing.value = !playing.value
}
</script>
