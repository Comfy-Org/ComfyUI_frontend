<script setup lang="ts">
import { ref } from 'vue'

import AngleNode from './AngleNode.vue'
import ColorNode from './ColorNode.vue'
import HeroImageCard from './HeroImageCard.vue'
import { useHeroPipeline } from './useHeroPipeline'
import { useIdleAutoplay } from './useIdleAutoplay'

const flowEl = ref<HTMLElement>()

const { pose, hue, saturation, output, outputFilter } = useHeroPipeline()

useIdleAutoplay({ pose, hue, saturation }, flowEl)
</script>

<template>
  <div ref="flowEl" class="flex w-full max-w-md flex-col items-stretch gap-3">
    <div class="relative">
      <div class="aspect-4/3 w-full pt-6 pl-8">
        <AngleNode
          v-model:azimuth="pose.azimuth"
          v-model:elevation="pose.elevation"
          v-model:zoom="pose.zoom"
        />
      </div>
      <!-- The input photo pinned over the node's corner keeps the
           image-in → image-out story visible on one phone screen. -->
      <div class="absolute top-0 left-0 aspect-4/3 w-28 -rotate-3 shadow-xl">
        <HeroImageCard
          src="/hero/input.webp"
          alt="Input image: futuristic over-ear headphones with transparent ear cups and glowing yellow accents"
          dot
        />
      </div>
      <!-- The COLOR node mirrors it in the opposite corner, scaled down and
           hung off the frame's lower edge so it just kisses the OUTPUT card
           below. -->
      <div
        class="absolute right-0 -bottom-7 z-10 h-24 w-44 rotate-2 text-[0.7rem] shadow-xl"
      >
        <ColorNode v-model:hue="hue" v-model:saturation="saturation" />
      </div>
    </div>
    <div class="relative aspect-4/3 w-full">
      <HeroImageCard
        :src="output.src"
        :filter="outputFilter"
        alt="Generated image rendered from the selected camera angle"
        label="OUTPUT"
      />
    </div>
  </div>
</template>
