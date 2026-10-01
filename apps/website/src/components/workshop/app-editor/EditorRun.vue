<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({ inheritAttrs: false })

const {
  label,
  credits,
  cancelLabel,
  running,
  disabled = false,
  block = false
} = defineProps<{
  label: string
  credits: string
  cancelLabel: string
  running: boolean
  disabled?: boolean
  /** Fills its row at a larger size, for a panel's pinned action. */
  block?: boolean
}>()

const emit = defineEmits<{ run: []; cancel: [] }>()
</script>

<template>
  <button
    v-if="running"
    type="button"
    :class="
      cn(
        'flex h-8 shrink-0 items-center gap-2 rounded-full bg-transparency-white-t8 px-3.5 text-xs font-medium text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
        block && 'h-10 w-full justify-center text-sm'
      )
    "
    @click="emit('cancel')"
  >
    <span
      class="size-3 rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    {{ cancelLabel }}
  </button>
  <button
    v-else
    v-bind="$attrs"
    type="button"
    :disabled
    :class="
      cn(
        'flex h-8 shrink-0 items-center gap-2 rounded-full bg-primary-comfy-yellow pr-1.5 pl-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
        block && 'h-10 w-full justify-center text-sm'
      )
    "
    @click="emit('run')"
  >
    {{ label }}
    <span
      class="rounded-full bg-primary-comfy-ink/10 px-2 py-0.5 text-[11px] font-medium"
      >{{ credits }}</span
    >
  </button>
</template>
