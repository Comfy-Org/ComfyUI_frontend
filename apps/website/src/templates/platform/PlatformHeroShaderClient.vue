<script setup lang="ts">
import { Ascii, CRTScreen, Godrays, Shader, SineWave, Swirl } from 'shaders/vue'
import { computed } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const raySpeed = computed(() => (prefersReducedMotion() ? 0 : 1.02))
</script>

<template>
  <div class="size-full bg-primary-comfy-ink">
    <Shader class="size-full">
      <CRTScreen
        :brightness="2.5"
        :color-shift="10"
        :curvature="0"
        :pixel-size="108"
        :scale-to-fill="0"
        :scanline-frequency="150"
        :scanline-intensity="0.56"
      >
        <Swirl
          :blend="88"
          :coarse-x="50"
          :coarse-y="50"
          color-a="#010b17"
          color-b="#040617"
          :detail="1.8"
          :fine-x="50"
          :fine-y="50"
          :medium-x="50"
          :medium-y="50"
        />
        <Ascii
          characters="01010101010101010101010101 "
          font-family="Space Mono"
        >
          <Godrays
            :center="{ x: 1, y: 0.5 }"
            :density="0.08"
            ray-color="#78a7ff"
            :speed="raySpeed"
          />
          <SineWave
            :amplitude="0.06"
            color="#3c4f8f"
            :frequency="0.6"
            :position="{ x: 0.5, y: 0 }"
            :softness="0.83"
            :thickness="0.09"
          />
        </Ascii>
      </CRTScreen>
    </Shader>
  </div>
</template>
