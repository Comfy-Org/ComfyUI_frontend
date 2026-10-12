<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { MoveObject, Rect } from '@/lib/workshop/move-anything/arrange'
import { isMoved } from '@/lib/workshop/move-anything/arrange'

const { objects, selected } = defineProps<{
  objects: readonly MoveObject[]
  selected?: string
}>()

function placed({ from, to }: { from: Rect; to: Rect }) {
  const sx = to.w / (from.w || 1)
  const sy = to.h / (from.h || 1)
  return `matrix(${sx} 0 0 ${sy} ${to.x - from.x * sx} ${to.y - from.y * sy})`
}
</script>

<template>
  <svg
    class="pointer-events-none absolute inset-0 size-full overflow-visible"
    viewBox="0 0 1 1"
    preserveAspectRatio="none"
    aria-hidden="true"
    data-testid="move-outlines"
  >
    <template v-for="object in objects" :key="object.id">
      <template v-if="object.mask">
        <path
          v-if="isMoved(object)"
          :d="object.mask.path"
          class="fill-primary-comfy-yellow/5 stroke-primary-comfy-yellow/60"
          stroke-width="1.5"
          stroke-dasharray="5 4"
          vector-effect="non-scaling-stroke"
          data-testid="move-ghost"
        />
        <path
          :d="object.mask.path"
          :transform="placed(object)"
          :class="
            cn(
              'transition-[fill-opacity]',
              object.id === selected
                ? 'fill-primary-comfy-yellow/15 stroke-primary-comfy-yellow'
                : 'fill-primary-warm-white/5 stroke-primary-warm-white/90'
            )
          "
          stroke-width="1.75"
          :stroke-dasharray="object.id === selected ? '7 4' : undefined"
          vector-effect="non-scaling-stroke"
          data-testid="move-outline"
        >
          <animate
            v-if="object.id === selected"
            attributeName="stroke-dashoffset"
            from="0"
            to="-22"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </path>
      </template>
    </template>
  </svg>
</template>
