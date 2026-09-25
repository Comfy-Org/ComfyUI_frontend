<script setup lang="ts">
const { option, metal, glass } = defineProps<{
  option: string
  metal: string
  glass: string
}>()
</script>
<template>
  <g>
    <path
      v-if="option === 'film35'"
      d="M37 43C18 18 38 5 57 15L77 27C97 9 119 29 100 46Z"
      :fill="metal"
    />
    <path v-else d="M48 39C31 17 52 7 67 18L82 28 95 38Z" :fill="metal" />
    <circle
      :cx="option === 'film35' ? 46 : 56"
      cy="27"
      :r="option === 'film35' ? 12 : 10"
      :fill="glass"
    />
    <circle v-if="option === 'film35'" cx="92" cy="33" r="11" :fill="glass" />
    <circle
      :cx="option === 'film35' ? 46 : 56"
      cy="27"
      r="3"
      fill="currentColor"
      stroke="none"
    />
    <circle
      v-if="option === 'film35'"
      cx="92"
      cy="33"
      r="3"
      fill="currentColor"
      stroke="none"
    />
  </g>
</template>
