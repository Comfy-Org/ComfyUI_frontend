<script setup lang="ts">
import { computed } from 'vue'
const { option, metal, glass } = defineProps<{
  option: string
  metal: string
  glass: string
}>()
const barrelStart = computed(() =>
  option === 'macro' ? 24 : option === 'vintage' ? 52 : 38
)
const lensHeight = computed(() =>
  option === 'anamorphic' ? 33 : option === 'vintage' ? 23 : 28
)
const frontRadius = computed(() => (option === 'anamorphic' ? 16 : 13))
const glassRadius = computed(() => (option === 'anamorphic' ? 9 : 8))
</script>
<template>
  <g :transform="option === 'tilt' ? 'rotate(-11 80 58)' : undefined">
    <path d="M24 97H137" stroke-opacity="0.15" />
    <template v-if="option === 'auto'">
      <circle cx="80" cy="57" r="35" :fill="metal" />
      <circle cx="80" cy="57" r="28" class="fill-primary-comfy-ink" />
      <circle cx="80" cy="57" r="22" :fill="glass" />
      <circle cx="80" cy="57" r="14" stroke-opacity="0.4" />
      <path d="M68 44Q80 35 91 44" stroke-opacity="0.7" />
    </template>
    <template v-else>
      <ellipse
        :cx="barrelStart"
        cy="58"
        rx="8"
        :ry="lensHeight - 3"
        :fill="metal"
      />
      <path
        :d="`M${barrelStart} ${61 - lensHeight}H112V${55 + lensHeight}H${barrelStart}Z`"
        :fill="metal"
      />
      <path
        v-for="n in 7"
        :key="n"
        :d="`M${barrelStart + 5 + n * 3} ${64 - lensHeight}V${52 + lensHeight}`"
        stroke-opacity="0.5"
      />
      <path
        :d="`M100 ${58 - lensHeight}V${58 + lensHeight}`"
        stroke-width="4"
        stroke-opacity="0.7"
      />
      <ellipse
        cx="114"
        cy="58"
        :rx="frontRadius"
        :ry="lensHeight"
        class="fill-primary-comfy-ink"
      />
      <ellipse
        cx="115"
        cy="58"
        :rx="glassRadius"
        :ry="lensHeight - 7"
        :fill="glass"
      />
      <path
        :d="`M112 ${65 - lensHeight}Q120 ${62 - lensHeight} 121 ${72 - lensHeight}`"
        stroke-opacity="0.8"
      />
      <path
        v-if="option === 'anamorphic'"
        d="M105 58H126"
        stroke-opacity="0.55"
      />
      <path v-if="option === 'vintage'" d="M59 82H87V90H65Z" :fill="metal" />
      <path
        v-if="option === 'macro'"
        d="M28 22H93M28 19V25M93 19V25M42 22V25M57 22V25M72 22V25"
        stroke-opacity="0.65"
      />
      <g v-if="option === 'tilt'">
        <path d="M78 26V90M84 27V89M72 32 92 29M72 86 92 89" stroke-width="2" />
        <rect x="73" y="18" width="15" height="8" rx="2" :fill="metal" />
      </g>
      <path
        v-if="option === 'prime'"
        d="M59 24H87M65 21V27M79 21V27"
        stroke-opacity="0.7"
      />
    </template>
  </g>
</template>
