<script setup lang="ts">
import {
  Ascii,
  Checkerboard,
  CRTScreen,
  CursorTrail,
  Shader,
  SineWave,
  Swirl
} from 'shaders/vue'
import { computed } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const swirlSpeed = computed(() => (prefersReducedMotion() ? 0 : 2.8))
</script>

<template>
  <div class="size-full bg-primary-comfy-ink">
    <Shader class="size-full">
      <Swirl
        :blend="60"
        color-a="#ff6600"
        color-b="#00ffee"
        :detail="1.9"
        :speed="swirlSpeed"
        :stops="[
          { color: '#ff6600', position: 0 },
          { color: '#00ffee', position: 1 }
        ]"
      />
      <CRTScreen
        blend-mode="hardLight"
        :brightness="1.1"
        :color-shift="0"
        :contrast="1.2"
      >
        <Checkerboard />
        <SineWave
          :amplitude="0.01"
          :frequency="0.9"
          :softness="0.27"
          :thickness="0.78"
        />
        <CursorTrail
          color-a="#ffee00"
          :radius="1"
          :stops="[
            { color: '#ffee00', position: 0 },
            { color: '#ff00aa', position: 1 }
          ]"
        />
        <Ascii :cell-size="65" :spacing="0.5" />
      </CRTScreen>
    </Shader>
  </div>
</template>
