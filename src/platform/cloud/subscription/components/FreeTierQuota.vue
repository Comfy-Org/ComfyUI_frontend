<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const MAX_AVAILABLE = 5
const DOT_COLORS = [
  'bg-destructive-background',
  'bg-warning-background',
  'bg-success-background'
]

const { t } = useI18n()
const available = 4
const dotColor = computed(
  () => DOT_COLORS[((available / MAX_AVAILABLE) * DOT_COLORS.length) | 0]
)
</script>
<template>
  <div
    class="pointer-events-auto mt-2 flex w-full items-center justify-between border-t border-border-subtle bg-comfy-menu-bg px-4 pt-2"
  >
    <div class="flex gap-2">
      <div
        v-for="index in MAX_AVAILABLE"
        :key="index"
        :class="
          cn(
            'size-1.5 rounded-full',
            index > available ? 'bg-secondary-background-selected' : dotColor
          )
        "
      />
    </div>
    <div v-text="t('actionbar.freeTierRuns', { available, MAX_AVAILABLE })" />
  </div>
</template>
