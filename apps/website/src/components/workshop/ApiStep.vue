<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const {
  step,
  title,
  body,
  current = false
} = defineProps<{
  step: number
  title: string
  body: string
  current?: boolean
}>()
</script>

<template>
  <li
    class="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 gap-y-3 not-last:before:absolute not-last:before:inset-s-3.5 not-last:before:top-3.5 not-last:before:-bottom-9.5 not-last:before:w-px not-last:before:bg-transparency-white-t20 lg:grid-cols-[1.75rem_minmax(0,1fr)_20rem] lg:items-center lg:gap-x-6 lg:not-last:before:top-1/2 lg:not-last:before:-bottom-[calc(50%+1.5rem)]"
  >
    <span
      aria-hidden="true"
      :class="
        cn(
          'relative z-1 flex size-7 items-center justify-center self-start rounded-full text-xs font-bold tabular-nums lg:self-center',
          current
            ? 'bg-primary-warm-white text-primary-comfy-ink'
            : 'bg-primary-comfy-ink-light text-primary-comfy-canvas ring-1 ring-transparency-white-t20'
        )
      "
    >
      {{ step }}
    </span>
    <div class="flex min-w-0 flex-col gap-1">
      <h3 class="text-lg/tight font-medium text-primary-warm-white">
        {{ title }}
      </h3>
      <p class="text-sm/relaxed text-primary-comfy-canvas/75">{{ body }}</p>
    </div>
    <div
      v-if="$slots.default"
      class="col-start-2 flex min-w-0 lg:col-start-3 lg:justify-end"
    >
      <slot />
    </div>
  </li>
</template>
