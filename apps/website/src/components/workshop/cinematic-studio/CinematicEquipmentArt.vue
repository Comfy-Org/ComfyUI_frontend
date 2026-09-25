<script setup lang="ts">
import { computed, useId } from 'vue'
import CinematicEquipmentBody from './CinematicEquipmentBody.vue'
import CinematicEquipmentLens from './CinematicEquipmentLens.vue'
import type { DirectionPart } from '../../../lib/workshop/cinematic-studio/catalog'

const { part, option } = defineProps<{ part: DirectionPart; option: string }>()
const id = useId()
const metal = `url(#${id}-metal)`
const glass = `url(#${id}-glass)`
function selected<T>(choices: Readonly<Record<string, T>>, fallback: T): T {
  return choices[option] ?? fallback
}
const iris = computed(() =>
  selected({ '1.4': 25, '2': 21, '2.8': 17, '4': 12, '8': 6 }, 18)
)
const focalSpread = computed(() =>
  selected({ '14': 43, '24': 35, '35': 28, '50': 21, '85': 14, '135': 9 }, 30)
)
</script>

<template>
  <svg
    viewBox="0 0 160 112"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linejoin="round"
    stroke-linecap="round"
    class="text-primary-comfy-canvas"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient
        :id="`${id}-metal`"
        x1="0"
        y1="0"
        x2="0.35"
        y2="1"
        gradientUnits="objectBoundingBox"
      >
        <stop stop-color="currentColor" stop-opacity="0.65" />
        <stop offset="0.38" stop-color="currentColor" stop-opacity="0.23" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0.08" />
      </linearGradient>
      <radialGradient :id="`${id}-glass`" cx="0.35" cy="0.3">
        <stop stop-color="currentColor" stop-opacity="0.32" />
        <stop offset="0.5" stop-color="currentColor" stop-opacity="0.08" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0" />
      </radialGradient>
    </defs>

    <CinematicEquipmentBody v-if="part === 'body'" :option :metal :glass />
    <CinematicEquipmentLens v-else-if="part === 'lens'" :option :metal :glass />
    <g v-else-if="part === 'aperture'">
      <circle cx="80" cy="56" r="41" :fill="metal" />
      <circle cx="80" cy="56" r="35" stroke-opacity="0.65" />
      <path
        v-for="n in 8"
        :key="n"
        :transform="`rotate(${n * 45} 80 56)`"
        :d="`M80 21Q109 24 ${80 + iris} 56L${80 + iris * 0.707} ${56 + iris * 0.707}`"
        stroke-opacity="0.75"
      />
      <circle
        cx="80"
        cy="56"
        :r="iris"
        class="fill-primary-comfy-ink"
        stroke-opacity="0.8"
      />
      <circle cx="80" cy="56" :r="iris - 2" :fill="glass" stroke="none" />
      <path
        v-for="n in 16"
        :key="`rim-${n}`"
        :transform="`rotate(${n * 22.5} 80 56)`"
        d="M80 17V19"
        stroke-opacity="0.65"
      />
    </g>

    <g v-else-if="part === 'focal'">
      <path
        :d="`M45 56 133 ${56 - focalSpread}V${56 + focalSpread}Z`"
        fill="currentColor"
        fill-opacity="0.07"
        stroke-opacity="0.5"
      />
      <path d="M46 56H137" stroke-dasharray="3 4" stroke-opacity="0.35" />
      <path
        :d="`M136 ${56 - focalSpread}H143M140 ${56 - focalSpread}V${56 + focalSpread}M136 ${56 + focalSpread}H143`"
        stroke-opacity="0.75"
      />
      <path d="M20 43H37V69H20Z" :fill="metal" />
      <path d="M28 43V69" stroke-opacity="0.5" />
      <ellipse cx="42" cy="56" rx="7" ry="19" class="fill-primary-comfy-ink" />
      <ellipse cx="43" cy="56" rx="4" ry="13" :fill="glass" />
      <path d="M25 73V79H47" stroke-opacity="0.5" />
      <path
        :d="`M68 ${56 - focalSpread * 0.26}Q${74 + focalSpread * 0.2} 56 68 ${56 + focalSpread * 0.26}`"
        stroke-opacity="0.5"
      />
    </g>
    <g v-else>
      <rect x="41" y="27" width="78" height="58" rx="8" :fill="metal" />
      <path d="M54 42V36H66M106 42V36H94M54 70V76H66M106 70V76H94" />
      <circle cx="80" cy="56" r="14" :fill="glass" />
    </g>
    <path
      v-if="option === 'auto'"
      d="M132 15 134 22 141 24 134 26 132 33 130 26 123 24 130 22Z"
      fill="currentColor"
      fill-opacity="0.7"
      stroke="none"
    />
  </svg>
</template>
