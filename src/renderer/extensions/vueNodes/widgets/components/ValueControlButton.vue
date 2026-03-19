<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { ControlOptions } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

const { mode, variant = 'badge' } = defineProps<{
  mode: ControlOptions
  variant?: 'badge' | 'button'
}>()

const { t } = useI18n()

const iconMap: Record<ControlOptions, string | null> = {
  fixed: 'icon-[lucide--pencil-off]',
  randomize: 'icon-[lucide--shuffle]',
  increment: null,
  decrement: null
}

const textMap: Record<ControlOptions, string | null> = {
  increment: '+1',
  decrement: '-1',
  fixed: null,
  randomize: null
}
</script>

<template>
  <button
    type="button"
    :aria-label="t('widgets.valueControl.' + mode)"
    :class="
      cn(
        'flex shrink-0 cursor-pointer items-center justify-center border-none focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:ring-offset-1 focus-visible:outline-none',
        variant === 'badge' ? 'h-4.5 w-8 rounded-full' : 'size-6 rounded-sm',
        mode !== 'fixed'
          ? 'bg-primary-background/30 hover:bg-primary-background-hover/30'
          : 'bg-transparent'
      )
    "
  >
    <i
      v-if="iconMap[mode]"
      aria-hidden="true"
      :class="
        cn(
          iconMap[mode] ?? '',
          'text-xs',
          mode === 'fixed' ? 'text-muted-foreground' : 'text-primary-background'
        )
      "
    />
    <span
      v-else-if="textMap[mode]"
      class="text-xs font-normal text-primary-background"
    >
      {{ textMap[mode] }}
    </span>
  </button>
</template>
