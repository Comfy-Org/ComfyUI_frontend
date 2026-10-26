<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { ControlOptions } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

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
    data-testid="value-control"
    type="button"
    :aria-label="t('widgets.valueControl.' + mode)"
    :class="
      cn(
        'flex shrink-0 cursor-pointer items-center justify-center border-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
        variant === 'badge' ? 'h-4.5 w-8 rounded-full' : 'size-6 rounded-sm',
        mode !== 'fixed'
          ? 'bg-primary/30 hover:bg-primary/27'
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
          'size-[0.9rem]',
          mode === 'fixed' ? 'text-muted-foreground' : 'text-primary'
        )
      "
    />
    <span v-else-if="textMap[mode]" class="text-xs font-normal text-primary">
      {{ textMap[mode] }}
    </span>
  </button>
</template>
