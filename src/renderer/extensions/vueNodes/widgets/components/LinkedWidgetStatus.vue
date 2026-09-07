<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type {
  LinkedWidgetDisplay,
  SimplifiedWidget
} from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

const { display, widget } = defineProps<{
  display: LinkedWidgetDisplay
  widget: Pick<SimplifiedWidget, 'name' | 'label'>
}>()

const { t } = useI18n()
</script>

<template>
  <div
    data-testid="linked-widget-placeholder"
    role="img"
    :aria-label="`${widget.label || widget.name}: ${t('widgets.linkedInput')}`"
    :title="t('widgets.linkedInput')"
    :class="
      cn(
        'absolute z-20 flex cursor-default items-center overflow-hidden bg-component-node-widget-background/40 select-none',
        display === 'switch'
          ? 'top-1 right-1 h-6 w-10 justify-center rounded-full'
          : display === 'expanding'
            ? 'inset-0 justify-start rounded-lg px-3'
            : 'inset-0 justify-start rounded-md px-3'
      )
    "
  >
    <i
      class="icon-[lucide--link] size-4 text-component-node-foreground-secondary opacity-40"
      aria-hidden="true"
    />
  </div>
</template>
