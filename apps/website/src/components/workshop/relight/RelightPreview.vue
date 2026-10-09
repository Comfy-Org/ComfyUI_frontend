<script setup lang="ts">
import type { Light, RelightScene } from '@/lib/workshop/relight/lights'
import { previewGlows, previewShade } from '@/lib/workshop/relight/preview'

const {
  lights,
  scene,
  lightOnly = false
} = defineProps<{
  lights: readonly Light[]
  scene: RelightScene
  lightOnly?: boolean
}>()
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden rounded-sm"
    data-testid="relight-preview"
    aria-hidden="true"
  >
    <div
      class="absolute inset-0 bg-black"
      data-testid="relight-preview-shade"
      :style="{ opacity: lightOnly ? 0.9 : previewShade(scene) }"
    />
    <div
      v-for="glow in previewGlows(lights)"
      :key="glow.id"
      class="absolute inset-0"
      :style="glow.style"
    />
  </div>
</template>
