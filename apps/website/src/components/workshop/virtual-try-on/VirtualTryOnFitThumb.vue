<script setup lang="ts">
import type { TryOnFit } from '../../../lib/workshop/virtual-try-on/garments'

const { fit } = defineProps<{ fit: TryOnFit }>()

const SHAPE = {
  slim: { half: 8, hem: 31, flare: 0 },
  regular: { half: 10, hem: 32, flare: 0.5 },
  relaxed: { half: 12.5, hem: 34, flare: 1.5 }
} as const satisfies Record<
  TryOnFit,
  { half: number; hem: number; flare: number }
>

function tee({ half, hem, flare }: (typeof SHAPE)[TryOnFit]) {
  const left = 32 - half
  const right = 32 + half
  const sleeve = 4 + half / 4
  return [
    'M28 11.5 Q32 14.5 36 11.5',
    `L${right} 13`,
    `L${right + sleeve} 19.5`,
    `L${right} 21.5`,
    `L${right + flare} ${hem}`,
    `L${left - flare} ${hem}`,
    `L${left} 21.5`,
    `L${left - sleeve} 19.5`,
    `L${left} 13Z`
  ].join(' ')
}
</script>

<template>
  <svg
    viewBox="0 0 64 36"
    class="absolute inset-0 size-full bg-linear-to-b from-primary-comfy-ink-light to-primary-comfy-ink"
    aria-hidden="true"
  >
    <circle cx="32" cy="7" r="3.5" class="fill-transparency-white-t20" />
    <path
      d="M24 13.5 Q32 10 40 13.5 L40.5 36 L23.5 36Z"
      class="fill-transparency-white-t8"
    />
    <path :d="tee(SHAPE[fit])" class="fill-primary-warm-white/85" />
  </svg>
</template>
