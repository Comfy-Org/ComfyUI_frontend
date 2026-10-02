<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { ShadowStyle } from '../../../lib/workshop/relight/shadows'

const { look } = defineProps<{ look: ShadowStyle }>()

const SHADOW = {
  none: 'left-[36%] w-[22%] h-1.5 bg-black/30 blur-[2px]',
  soft: 'left-[38%] w-[40%] h-3 bg-black/70 blur-[6px]',
  hard: 'left-[40%] w-[34%] h-2 bg-black/85',
  long: 'left-[42%] w-[58%] h-2 bg-linear-to-r from-black/85 to-transparent blur-[1px]'
} as const satisfies Record<ShadowStyle, string>

const SPHERE = {
  none: 'bg-radial-[at_45%_38%] from-primary-comfy-canvas via-primary-warm-gray to-secondary-cool-gray',
  soft: 'bg-radial-[at_32%_30%] from-primary-warm-white via-primary-warm-gray to-primary-comfy-ink',
  hard: 'bg-radial-[at_32%_30%] from-primary-warm-white via-primary-warm-gray to-primary-comfy-ink',
  long: 'bg-radial-[at_14%_46%] from-primary-comfy-orange via-secondary-mauve to-primary-comfy-ink'
} as const satisfies Record<ShadowStyle, string>
</script>

<template>
  <span
    class="absolute inset-0 block bg-linear-to-b from-primary-comfy-ink-light from-58% to-primary-comfy-ink to-58%"
    aria-hidden="true"
  >
    <span
      :class="
        cn('absolute top-[58%] -translate-y-1/2 rounded-full', SHADOW[look])
      "
    />
    <span
      :class="
        cn(
          'absolute top-[22%] left-[30%] aspect-square w-[24%] rounded-full',
          SPHERE[look]
        )
      "
    />
  </span>
</template>
