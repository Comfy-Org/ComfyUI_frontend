<script setup lang="ts">
import type { LightColor } from '../../../lib/workshop/relight/lights'
import { lightHex } from '../../../lib/workshop/relight/lights'

const { colors } = defineProps<{ colors: readonly LightColor[] }>()
</script>

<template>
  <span class="-ml-0.5 flex items-center" aria-hidden="true">
    <span
      v-for="(color, index) in colors.slice(0, 3)"
      :key="index"
      class="size-3 rounded-full border border-primary-comfy-ink-light not-first:-ml-1"
      :style="{ backgroundColor: lightHex(color) }"
    />
  </span>
</template>
