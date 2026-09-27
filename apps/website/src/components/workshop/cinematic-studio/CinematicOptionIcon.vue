<script setup lang="ts">
import { computed } from 'vue'

import { cameraIcon } from '../../../lib/workshop/cinematic-studio/camera-icons'
import type { DirectionPart } from '../../../lib/workshop/cinematic-studio/catalog'

const { part, option } = defineProps<{
  part: DirectionPart
  option: string
}>()

const icon = computed(() => cameraIcon(part, option))
</script>

<template>
  <svg
    v-if="icon"
    viewBox="0 0 40 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(path, index) in icon.paths" :key="index" :d="path" />
    <text
      v-if="icon.badge"
      x="27"
      y="23"
      fill="currentColor"
      stroke="none"
      font-size="8"
      font-weight="700"
    >
      {{ icon.badge }}
    </text>
  </svg>
</template>
