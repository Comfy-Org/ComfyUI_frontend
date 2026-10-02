<script setup lang="ts">
import { useId } from 'vue'

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
const describedBy = () => (missing && block ? missingId : undefined)
const text = () => (missing && !block ? missing : label)
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
      :aria-describedby="describedBy()"
      :class="
        cn(
          'flex h-8 shrink-0 items-center gap-2 rounded-full bg-primary-comfy-yellow pr-1.5 pl-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
          missing && 'pr-3.5',
          block && 'h-10 w-full justify-center text-sm'
        )
      "
      @click="emit('run')"
    >
      {{ text() }}
      <span
        v-if="!missing"
        class="rounded-full bg-primary-comfy-ink/10 px-2 py-0.5 text-[11px] font-medium"
        >{{ credits }}</span
      >
    </button>
  </template>
</template>
