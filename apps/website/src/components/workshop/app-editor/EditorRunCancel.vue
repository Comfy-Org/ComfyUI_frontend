<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { RunProgress } from './run-progress'

const {
  label,
  block = false,
  progress,
  queuedLabel
} = defineProps<{
  label: string
  block?: boolean
  progress?: RunProgress
  queuedLabel?: string
}>()

const emit = defineEmits<{ cancel: [] }>()

const percent = () =>
  progress?.kind === 'running' ? progress.percent : undefined
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :class="
      cn(
        'relative isolate flex h-8 shrink-0 items-center gap-2 overflow-hidden rounded-full bg-transparency-white-t8 px-3.5 text-xs font-medium text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
        block && 'h-10 w-full justify-center text-sm'
      )
    "
    data-testid="editor-run-cancel"
    @click="emit('cancel')"
  >
    <span
      v-if="percent() !== undefined"
      class="absolute inset-y-0 left-0 -z-10 bg-primary-comfy-yellow/15 transition-[width] duration-300"
      :style="{ width: `${percent()}%` }"
      aria-hidden="true"
    />
    <span
      class="size-3 rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    {{ label }}
    <span
      v-if="progress"
      class="rounded-full bg-transparency-white-t8 px-2 py-0.5 text-[11px] text-primary-comfy-canvas tabular-nums"
      data-testid="editor-run-progress"
      >{{ percent() === undefined ? queuedLabel : `${percent()}%` }}</span
    >
  </button>
</template>
