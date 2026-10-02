<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteSheetResult } from '../../../lib/workshop/sprite-sheet/contract'

const {
  result,
  index,
  pixel = false
} = defineProps<{
  result: SpriteSheetResult
  index: number
  /** Keeps pixel art's hard edges when it is scaled. */
  pixel?: boolean
}>()

const at = (place: number, count: number) =>
  count > 1 ? `${(place / (count - 1)) * 100}%` : '0%'
</script>

<template>
  <span
    :class="
      cn(
        'pointer-events-none absolute inset-0 block bg-no-repeat',
        pixel && '[image-rendering:pixelated]'
      )
    "
    :style="{
      backgroundImage: `url('${result.url}')`,
      backgroundSize: `${result.columns * 100}% ${result.rows * 100}%`,
      backgroundPosition: `${at(index % result.columns, result.columns)} ${at(
        Math.floor(index / result.columns),
        result.rows
      )}`
    }"
    aria-hidden="true"
  />
</template>
