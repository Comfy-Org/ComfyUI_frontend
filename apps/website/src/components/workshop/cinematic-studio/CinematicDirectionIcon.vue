<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, useId } from 'vue'

import type { DirectionPart } from '../../../lib/workshop/cinematic-studio/catalog'
import type { LineRole } from '../../../lib/workshop/cinematic-studio/direction-icons'
import { directionIcon } from '../../../lib/workshop/cinematic-studio/direction-icons'

const { part, option } = defineProps<{
  part: DirectionPart
  option: string
}>()

const icon = computed(() => directionIcon(part, option))
const id = useId()
const paint = (name: string) => `url(#${id}-${name})`

const stroke = (width: number, opacity = 1): CSSProperties => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: width,
  strokeOpacity: opacity,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
})
const outlined = (fillOpacity: number): CSSProperties => ({
  ...stroke(1.5),
  fill: 'currentColor',
  fillOpacity
})

const ROLES: Readonly<Record<LineRole, readonly CSSProperties[]>> = {
  frame: [
    {
      fill: 'var(--color-transparency-white-t4)',
      stroke: 'currentColor',
      strokeOpacity: 0.28,
      strokeWidth: 1
    }
  ],
  body: [outlined(0.08)],
  top: [outlined(0.2)],
  dark: [{ ...stroke(1.5), fill: 'var(--color-primary-comfy-ink)' }],
  accent: [{ fill: 'currentColor', fillOpacity: 0.75 }],
  glow: [{ fill: 'currentColor', opacity: 0.22, filter: paint('blur') }],
  neon: [{ ...stroke(3, 0.4), filter: paint('blurS') }, stroke(1.6)],
  ring: [stroke(2)],
  stroke: [stroke(1.6)],
  line: [stroke(1.2, 0.55)],
  groove: [stroke(1)],
  glint: [{ fill: 'currentColor' }],
  dashed: [
    {
      ...stroke(1.6),
      stroke: 'var(--color-primary-warm-gray)',
      strokeDasharray: '3 3'
    }
  ],
  vivid: [{ fill: paint('vivid') }],
  stripes: [{ fill: paint('stripes') }],
  leak: [{ ...stroke(5, 0.35), filter: paint('blurS') }]
}
</script>

<template>
  <svg v-if="icon" viewBox="0 0 40 40" aria-hidden="true">
    <defs>
      <linearGradient :id="`${id}-vivid`" x1="0" y1="0" x2="1" y2="1">
        <stop
          offset="0"
          :style="{ stopColor: 'var(--color-primary-warm-white)' }"
        />
        <stop
          offset="1"
          :style="{ stopColor: 'var(--color-primary-warm-gray)' }"
        />
      </linearGradient>
      <pattern
        :id="`${id}-stripes`"
        width="3"
        height="3"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="3" height="3" :style="{ fill: 'currentColor' }" />
        <rect
          width="1.5"
          height="3"
          :style="{ fill: 'var(--color-primary-comfy-ink)' }"
        />
      </pattern>
      <filter :id="`${id}-blur`" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
      <filter :id="`${id}-blurS`" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.2" />
      </filter>
    </defs>
    <template v-for="(shape, index) in icon" :key="index">
      <text
        v-if="shape.kind === 'label'"
        :x="shape.x"
        :y="shape.y"
        text-anchor="middle"
        font-weight="700"
        :font-size="shape.size"
        :style="{ fill: 'var(--color-primary-comfy-ink)' }"
      >
        {{ shape.text }}
      </text>
      <template v-else>
        <path
          v-for="(style, layer) in ROLES[shape.role]"
          :key="layer"
          :d="shape.d"
          :style="style"
        />
      </template>
    </template>
  </svg>
</template>
