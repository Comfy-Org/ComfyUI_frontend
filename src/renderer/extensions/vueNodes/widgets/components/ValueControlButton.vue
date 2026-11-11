<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { ControlOptions } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

const { mode } = defineProps<{
  mode: ControlOptions
}>()

const { t } = useI18n()

const iconMap: Record<ControlOptions, string | null> = {
  fixed: 'icon-[lucide--pencil-off]',
  randomize: 'icon-[lucide--shuffle]',
  increment: null,
  'increment-wrap': null,
  decrement: null
}

const textMap: Record<ControlOptions, string | null> = {
  increment: '+1',
  'increment-wrap': '+1↻',
  decrement: '-1',
  fixed: null,
  randomize: null
}
</script>

<template>
  <button
    data-testid="value-control"
    type="button"
    :aria-label="
      mode === 'increment-wrap'
        ? t('widgets.valueControl.increment-wrap')
        : t('widgets.valueControl.' + mode)
    "
    :class="
      cn(
        'flex shrink-0 cursor-pointer items-center justify-center border-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none',
        'h-5 w-9 rounded-full',
        mode !== 'fixed'
          ? 'bg-foreground/10 hover:bg-foreground/20'
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
          'size-3.5',
          mode === 'fixed' ? 'text-muted-foreground' : 'text-foreground'
        )
      "
    />
    <span v-else-if="textMap[mode]" class="text-xs font-normal text-foreground">
      {{ textMap[mode] }}
    </span>
  </button>
</template>
