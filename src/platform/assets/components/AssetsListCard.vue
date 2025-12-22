<template>
  <div class="relative flex items-center gap-2 overflow-hidden rounded-lg p-2">
    <div
      v-if="
        progressTotalPercent !== undefined ||
        progressCurrentPercent !== undefined
      "
      class="absolute inset-0"
    >
      <div
        v-if="progressTotalPercent !== undefined"
        class="pointer-events-none absolute inset-y-0 left-0 h-full bg-interface-panel-job-progress-primary transition-[width]"
        :style="{ width: `${clampPercent(progressTotalPercent)}%` }"
      />
      <div
        v-if="progressCurrentPercent !== undefined"
        class="pointer-events-none absolute inset-y-0 left-0 h-full bg-interface-panel-job-progress-secondary transition-[width]"
        :style="{ width: `${clampPercent(progressCurrentPercent)}%` }"
      />
    </div>

    <div
      :class="
        cn(
          'relative z-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-secondary-background',
          iconWrapperClass
        )
      "
      :aria-label="iconAriaLabel || undefined"
    >
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="previewAlt"
        class="size-full object-cover"
      />
      <div v-else class="flex size-full items-center justify-center">
        <i
          aria-hidden="true"
          :class="
            cn(
              iconName ?? 'icon-[lucide--image]',
              'size-4 text-text-secondary',
              iconClass
            )
          "
        />
      </div>
    </div>

    <div class="relative z-1 flex min-w-0 flex-1 flex-col gap-1">
      <div
        v-if="$slots.primary || primaryText"
        class="text-xs leading-none text-text-primary"
      >
        <slot name="primary">{{ primaryText }}</slot>
      </div>
      <div
        v-if="$slots.secondary || secondaryText"
        class="text-xs leading-none text-text-secondary"
      >
        <slot name="secondary">{{ secondaryText }}</slot>
      </div>
    </div>

    <div v-if="$slots.actions" class="relative z-1 flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

const {
  previewUrl,
  previewAlt = '',
  iconName,
  iconAriaLabel,
  iconClass,
  iconWrapperClass,
  primaryText,
  secondaryText,
  progressTotalPercent,
  progressCurrentPercent
} = defineProps<{
  previewUrl?: string
  previewAlt?: string
  iconName?: string
  iconAriaLabel?: string
  iconClass?: string
  iconWrapperClass?: string
  primaryText?: string
  secondaryText?: string
  progressTotalPercent?: number
  progressCurrentPercent?: number
}>()

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}
</script>
