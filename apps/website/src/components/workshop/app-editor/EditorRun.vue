<script setup lang="ts">
import { useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { RunProgress } from './run-progress'

defineOptions({ inheritAttrs: false })

const {
  label,
  credits,
  cancelLabel,
  running,
  disabled = false,
  block = false,
  progress,
  queuedLabel,
  missing
} = defineProps<{
  label: string
  credits: string
  cancelLabel: string
  running: boolean
  disabled?: boolean
  /** Fills its row at a larger size, for a panel's pinned action. */
  block?: boolean
  /** How far the run has got, shown on the button while it runs. */
  progress?: RunProgress
  /** Shown while the run waits in the queue. */
  queuedLabel?: string
  /**
   * What the run still needs. Disables the button and says so in place of
   * the credits it would cost.
   */
  missing?: string
}>()

const emit = defineEmits<{ run: []; cancel: [] }>()
const missingId = useId()
</script>

<template>
  <button
    v-if="running"
    type="button"
    :aria-label="cancelLabel"
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
      v-if="progress?.kind === 'running'"
      class="absolute inset-y-0 left-0 -z-10 bg-primary-comfy-yellow/15 transition-[width] duration-300"
      :style="{ width: `${progress.percent}%` }"
      aria-hidden="true"
    />
    <span
      class="size-3 rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    {{ cancelLabel }}
    <span
      v-if="progress"
      class="rounded-full bg-transparency-white-t8 px-2 py-0.5 text-[11px] text-primary-comfy-canvas tabular-nums"
      data-testid="editor-run-progress"
      >{{
        progress.kind === 'running' ? `${progress.percent}%` : queuedLabel
      }}</span
    >
  </button>
  <template v-else>
    <p
      v-if="missing && block"
      :id="missingId"
      class="pb-2 text-center text-[11px] text-primary-warm-gray"
      data-testid="editor-run-missing"
    >
      {{ missing }}
    </p>
    <button
      v-bind="$attrs"
      type="button"
      :disabled="disabled || Boolean(missing)"
      :title="missing"
      :aria-describedby="missing && block ? missingId : undefined"
      :class="
        cn(
          'flex h-8 shrink-0 items-center gap-2 rounded-full bg-primary-comfy-yellow pr-1.5 pl-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
          missing && 'pr-3.5',
          block && 'h-10 w-full justify-center text-sm'
        )
      "
      @click="emit('run')"
    >
      {{ missing && !block ? missing : label }}
      <span
        v-if="!missing"
        class="rounded-full bg-primary-comfy-ink/10 px-2 py-0.5 text-[11px] font-medium"
        >{{ credits }}</span
      >
    </button>
  </template>
</template>
