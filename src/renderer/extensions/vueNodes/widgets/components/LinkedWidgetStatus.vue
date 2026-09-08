<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type {
  LinkedWidgetDisplay,
  SimplifiedWidget
} from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

const { display, widget } = defineProps<{
  display: LinkedWidgetDisplay | 'switch'
  widget: Pick<SimplifiedWidget, 'name' | 'label'>
}>()

const { t } = useI18n()

const displayClasses: Record<LinkedWidgetDisplay | 'switch', string> = {
  control: 'inset-0 justify-start rounded-md px-3',
  multiline: 'inset-0 justify-start rounded-lg px-3',
  switch:
    'top-1/2 right-0.5 h-5 w-9 -translate-y-1/2 justify-center rounded-full'
}
</script>

<template>
  <div
    role="img"
    :aria-label="
      t('widgets.linkedInputFor', { name: widget.label || widget.name })
    "
    :class="
      cn(
        'absolute z-20 flex cursor-default items-center overflow-hidden bg-component-node-widget-background-disabled select-none',
        displayClasses[display]
      )
    "
  >
    <i
      class="icon-[lucide--link] size-4 text-component-node-foreground-secondary"
      aria-hidden="true"
    />
  </div>
</template>
