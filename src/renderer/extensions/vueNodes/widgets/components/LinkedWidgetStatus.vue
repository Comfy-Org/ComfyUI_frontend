<script setup lang="ts">
import { computed } from 'vue'

import { st } from '@/i18n'
import type {
  LinkedWidgetDisplay,
  SimplifiedWidget
} from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

const {
  display,
  widget,
  rounded = 'md'
} = defineProps<{
  display: LinkedWidgetDisplay
  widget: Pick<SimplifiedWidget, 'label' | 'name'>
  rounded?: 'md' | 'lg'
}>()

const linkedLabel = computed(() => st('widgets.linkedInput', 'Linked input'))
const accessibleName = computed(
  () => `${widget.label || widget.name}: ${linkedLabel.value}`
)
</script>

<template>
  <div
    data-testid="linked-widget-placeholder"
    :data-linked-display="display"
    role="img"
    :aria-label="accessibleName"
    :title="linkedLabel"
    :class="
      cn(
        'absolute z-20 flex cursor-default items-center overflow-hidden bg-component-node-widget-background/40 select-none',
        display === 'switch'
          ? 'top-1 right-1 h-6 w-10 justify-center rounded-full'
          : display === 'expanding'
            ? 'inset-0 justify-start rounded-lg px-3'
            : cn(
                'inset-0 justify-start px-3',
                rounded === 'lg' ? 'rounded-lg' : 'rounded-md'
              )
      )
    "
  >
    <i
      class="icon-[lucide--link] size-4 text-component-node-foreground-secondary opacity-40"
      aria-hidden="true"
    />
  </div>
</template>
