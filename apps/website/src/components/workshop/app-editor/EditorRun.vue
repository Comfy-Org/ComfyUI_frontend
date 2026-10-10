<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import EditorRunCancel from './EditorRunCancel.vue'
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
  missing,
  missingHint
} = defineProps<{
  label: string
  /** What the run costs, as a chip on the button; omitted when the app says it elsewhere. */
  credits?: string
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
   * What the run still needs. Disables the button, which says so in place
   * of its label and the credits it would cost.
   */
  missing?: string
  /** The full sentence for the tooltip, when `missing` is a short form. */
  missingHint?: string
}>()

const emit = defineEmits<{ run: []; cancel: [] }>()
</script>

<template>
  <EditorRunCancel
    v-if="running"
    :label="cancelLabel"
    :block
    :progress
    :queued-label
    @cancel="emit('cancel')"
  />
  <button
    v-else
    v-bind="$attrs"
    type="button"
    :disabled="disabled || Boolean(missing)"
    :title="missingHint ?? missing"
    :class="
      cn(
        'flex h-8 min-w-0 shrink-0 items-center gap-2 rounded-full bg-primary-comfy-yellow pr-1.5 pl-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
        block && 'h-10 w-full justify-center text-sm',
        missing && 'px-3.5 text-xs'
      )
    "
    @click="emit('run')"
  >
    <span v-if="missing" class="truncate">{{ missing }}</span>
    <template v-else>
      {{ label }}
      <span
        v-if="credits"
        class="rounded-full bg-primary-comfy-ink/10 px-2 py-0.5 text-[11px] font-medium"
        >{{ credits }}</span
      >
    </template>
  </button>
</template>
