<script setup lang="ts">
import AngleNode from './AngleNode.vue'
import ColorNode from './ColorNode.vue'
import HeroImageCard from './HeroImageCard.vue'
import { useHeroPipeline } from './useHeroPipeline'

const { pose, hue, saturation, output, outputFilter } = useHeroPipeline()
</script>

<template>
  <div class="flex w-full max-w-md flex-col items-stretch gap-5">
    <div class="aspect-1392/752 w-full">
      <HeroImageCard
        src="/hero/input.webp"
        alt="Input image: two robotic hands reaching toward each other through glowing rings"
      />
    </div>
    <div class="aspect-square w-full">
      <AngleNode
        v-model:azimuth="pose.azimuth"
        v-model:elevation="pose.elevation"
        v-model:zoom="pose.zoom"
      />
    </div>
    <div class="h-36 w-full">
      <ColorNode v-model:hue="hue" v-model:saturation="saturation" />
    </div>
    <div class="relative aspect-1392/752 w-full">
      <HeroImageCard
        :src="output.src"
        :filter="outputFilter"
        alt="Generated image rendered from the selected camera angle"
        label="OUTPUT"
      />
    </div>
  </div>
</template>
