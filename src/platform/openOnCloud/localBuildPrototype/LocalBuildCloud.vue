<template>
  <svg
    width="151"
    height="99"
    viewBox="0 0 151 99"
    fill="none"
    overflow="visible"
    aria-hidden="true"
    class="block"
  >
    <path
      ref="shadow"
      :d="SHADOW_PATH"
      :fill="`url(#${shadowId})`"
      class="origin-[77px_89px]"
    />
    <g ref="body">
      <path :d="CLOUD_PATH" :fill="`url(#${bodyId})`" />
      <path :d="CLOUD_PATH" :fill="`url(#${glowId})`" />
      <path
        :d="CLOUD_PATH"
        stroke="white"
        stroke-opacity="0.18"
        stroke-width="0.685088"
      />
    </g>
    <defs>
      <radialGradient
        :id="shadowId"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(77.3876 89.4821) scale(43.2581 4.75895)"
      >
        <stop stop-opacity="0.55" />
        <stop offset="1" stop-opacity="0" />
      </radialGradient>
      <linearGradient
        :id="bodyId"
        x1="28.3587"
        y1="22.487"
        x2="28.3587"
        y2="78.172"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#9A9AA0" />
        <stop offset="0.55" stop-color="#55555B" />
        <stop offset="1" stop-color="#2A2A2E" />
      </linearGradient>
      <radialGradient
        :id="glowId"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(72.4369 61.4665) scale(58.771 33.411)"
      >
        <stop stop-color="white" stop-opacity="0.55" />
        <stop offset="1" stop-color="#E4E4E4" stop-opacity="0" />
      </radialGradient>
    </defs>
  </svg>
</template>

<script setup lang="ts">
import { useAnimate, usePreferredReducedMotion } from '@vueuse/core'
import { useId, useTemplateRef, watchEffect } from 'vue'

const { floating = false } = defineProps<{ floating?: boolean }>()

const shadowId = useId()
const bodyId = useId()
const glowId = useId()

const loop = {
  duration: 3000,
  iterations: Number.POSITIVE_INFINITY,
  easing: 'ease-in-out',
  immediate: false
}
const bob = useAnimate(
  useTemplateRef<SVGGElement>('body'),
  [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-4px)' },
    { transform: 'translateY(0)' }
  ],
  loop
)
const breathe = useAnimate(
  useTemplateRef<SVGPathElement>('shadow'),
  [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(0.88)', opacity: 0.7 },
    { transform: 'scale(1)', opacity: 1 }
  ],
  loop
)
const reducedMotion = usePreferredReducedMotion()

watchEffect(() => {
  const shouldFloat = floating && reducedMotion.value !== 'reduce'
  for (const motion of [bob, breathe]) {
    if (shouldFloat) motion.play()
    else motion.cancel()
  }
})

const SHADOW_PATH =
  'M77.3876 94.241C101.278 94.241 120.646 92.1104 120.646 89.4821C120.646 86.8538 101.278 84.7232 77.3876 84.7232C53.4969 84.7232 34.1296 86.8538 34.1296 89.4821C34.1296 92.1104 53.4969 94.241 77.3876 94.241Z'
const CLOUD_PATH =
  'M45.403 78.0537H109.355C113.594 78.307 117.759 76.8455 120.934 73.9905C124.108 71.1356 126.032 67.1211 126.282 62.8303C126.533 58.5394 125.089 54.3237 122.268 51.1104C119.448 47.8972 115.482 45.9497 111.242 45.6963C110.555 40.1446 108.15 34.9554 104.371 30.8719C100.592 26.7885 95.6334 24.0203 90.2051 22.9638C84.7768 21.9073 79.1575 22.6168 74.1519 24.9905C69.1463 27.3643 65.0113 31.2805 62.3391 36.1784C58.125 35.4543 53.7929 36.1859 50.0394 38.2557C46.2859 40.3254 43.3293 43.613 41.6452 47.5895C37.6541 48.0939 34.0244 50.1824 31.5546 53.3957C29.0848 56.6089 27.9773 60.6836 28.4756 64.7234C28.9739 68.7632 31.0373 72.4372 34.2118 74.9371C37.3863 77.437 41.4119 78.5581 45.403 78.0537Z'
</script>
