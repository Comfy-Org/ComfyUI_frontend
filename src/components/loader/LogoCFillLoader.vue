<template>
  <span role="status" :class="cn('inline-flex', colorClass)">
    <svg
      :width="Math.round(heightMap[size] * (VB_W / VB_H))"
      :height="heightMap[size]"
      :viewBox="`0 0 ${VB_W} ${VB_H}`"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask :id="maskId">
          <path :d="C_PATH" fill="white" />
        </mask>
      </defs>
      <path
        v-if="bordered"
        :d="C_PATH"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
        opacity="0.4"
      />
      <g :mask="`url(#${maskId})`">
        <rect
          :class="disableAnimation ? undefined : 'c-fill-rect'"
          :x="-BLEED"
          :y="-BLEED"
          :width="VB_W + BLEED * 2"
          :height="VB_H + BLEED * 2"
          fill="currentColor"
        />
      </g>
    </svg>
    <span class="sr-only">{{ t('g.loading') }}</span>
  </span>
</template>

<script setup lang="ts">
import { useId, computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'
import { useI18n } from 'vue-i18n'

const {
  size = 'md',
  color = 'black',
  bordered = true,
  disableAnimation = false
} = defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'yellow' | 'blue' | 'white' | 'black'
  bordered?: boolean
  disableAnimation?: boolean
}>()

const { t } = useI18n()
const maskId = `c-mask-${useId()}`

const VB_W = 185
const VB_H = 201
const BLEED = 1

// Larger than LogoComfyWaveLoader because the C logo is near-square (185×201)
// while the COMFY wordmark is wide (879×284), so larger heights are needed
// for visually comparable perceived size.
const heightMap = { sm: 48, md: 80, lg: 120, xl: 200 } as const
const colorMap = {
  yellow: 'text-brand-yellow',
  blue: 'text-brand-blue',
  white: 'text-white',
  black: 'text-black'
} as const

const colorClass = computed(() => colorMap[color])

const C_PATH =
  'M42.1217 200.812C37.367 200.812 33.5304 199.045 31.0285 195.703C28.4569 192.27 27.7864 187.477 29.1882 182.557L34.8172 162.791C35.2661 161.217 34.9537 159.523 33.9747 158.214C32.9958 156.908 31.464 156.139 29.8371 156.139L13.6525 156.139C8.89521 156.139 5.05862 154.374 2.55797 151.032C-0.0136533 147.597-0.684085 142.804 0.71869 137.883L20.0565 70.289L22.1916 62.8625C25.0617 52.7847 35.5288 44.5943 45.528 44.5943L64.8938 44.5943C67.2048 44.5943 69.2376 43.0535 69.8738 40.8175L76.2782 18.3344C79.1454 8.26681 89.6127 0.0763962 99.6117 0.0763945L141.029 0.00258328L171.349-2.99253e-05C176.104-3.0756e-05 179.941 1.765 182.442 5.10626C185.013 8.53932 185.684 13.3324 184.282 18.2528L175.612 48.6947C172.746 58.7597 162.279 66.9475 152.28 66.9475L110.771 67.0265L91.4113 67.0265C89.1029 67.0265 87.0727 68.5647 86.4326 70.7983L70.2909 127.179C69.8394 128.756 70.1518 130.454 71.1334 131.763C72.1123 133.07 73.6441 133.839 75.2697 133.839C75.2736 133.839 102.699 133.785 102.699 133.785L132.929 133.785C137.685 133.785 141.522 135.55 144.023 138.892C146.594 142.327 147.265 147.12 145.862 152.041L137.192 182.478C134.326 192.545 123.859 200.733 113.86 200.733L72.3517 200.812L42.1217 200.812Z'
</script>

<style scoped>
.c-fill-rect {
  animation: c-fill-up 2.5s cubic-bezier(0.25, 0, 0.3, 1) forwards;
  will-change: transform;
}

@keyframes c-fill-up {
  0% {
    transform: translateY(calc(v-bind(VB_H) * 1px + v-bind(BLEED) * 1px));
  }
  100% {
    transform: translateY(calc(v-bind(BLEED) * -1px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .c-fill-rect {
    animation: none;
  }
}
</style>
