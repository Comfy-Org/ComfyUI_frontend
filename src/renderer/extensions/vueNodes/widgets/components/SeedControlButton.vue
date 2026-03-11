<script setup lang="ts">
import type { ControlOptions } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

type SeedControlMode = ControlOptions | 'linked'

const { mode, variant = 'badge' } = defineProps<{
  mode: SeedControlMode
  variant?: 'badge' | 'button'
}>()

const iconMap: Record<SeedControlMode, string | null> = {
  fixed: 'icon-[lucide--settings-2]',
  randomize: 'icon-[lucide--shuffle]',
  linked: 'icon-[lucide--link]',
  increment: null,
  decrement: null
}

const textMap: Record<SeedControlMode, string | null> = {
  increment: '+1',
  decrement: '-1',
  fixed: null,
  randomize: null,
  linked: null
}
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'flex shrink-0 cursor-pointer items-center justify-center border-none',
        variant === 'badge' ? 'h-4.5 w-8 rounded-full' : 'size-6 rounded-sm',
        mode !== 'fixed'
          ? 'bg-primary-background/30 hover:bg-primary-background-hover/30'
          : 'bg-transparent'
      )
    "
  >
    <i
      v-if="iconMap[mode]"
      :class="
        cn(
          iconMap[mode]!,
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
