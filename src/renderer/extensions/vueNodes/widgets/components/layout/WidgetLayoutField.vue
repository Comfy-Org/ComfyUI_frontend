<script setup lang="ts">
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

import LinkedWidgetStatus from '../LinkedWidgetStatus.vue'

const {
  widget,
  rootClass,
  linkedStatusRounded = 'md'
} = defineProps<{
  widget: Pick<
    SimplifiedWidget<string | number | undefined>,
    'name' | 'label' | 'borderStyle' | 'linkedDisplay'
  >
  rootClass?: string
  noBorder?: boolean
  linkedStatusRounded?: 'md' | 'lg'
}>()

const hideLayoutField = useHideLayoutField()
const borderStyle = computed(() =>
  cn(
    'focus-within:ring focus-within:ring-component-node-widget-background-highlighted',
    widget.borderStyle
  )
)
const linkedDisplay = computed(() =>
  widget.linkedDisplay === 'control' ? widget.linkedDisplay : undefined
)

function stopWidgetPointer(event: PointerEvent) {
  if (!linkedDisplay.value) event.stopPropagation()
}
</script>

<template>
  <div
    :class="
      cn(
        'grid min-w-0 grid-cols-subgrid justify-between gap-2 text-node-component-slot-text',
        rootClass
      )
    "
  >
    <div
      v-if="!hideLayoutField"
      data-testid="widget-layout-field-label"
      class="content-center-safe truncate"
    >
      <template v-if="widget.name">
        {{ widget.label || widget.name }}
      </template>
    </div>
    <!-- basis-full grow -->
    <div class="relative min-w-0 flex-1">
      <div
        :class="
          cn(
            'relative min-w-0 cursor-default rounded-md transition-all',
            !noBorder && borderStyle
          )
        "
        @pointerdown="stopWidgetPointer"
        @pointermove="stopWidgetPointer"
        @pointerup="stopWidgetPointer"
      >
        <div
          :class="cn('contents', linkedDisplay && 'invisible')"
          :aria-hidden="linkedDisplay ? 'true' : undefined"
          :inert="linkedDisplay ? true : undefined"
          :data-testid="linkedDisplay ? 'linked-widget-content' : undefined"
        >
          <slot :border-style />
        </div>
        <LinkedWidgetStatus
          v-if="linkedDisplay"
          :display="linkedDisplay"
          :widget
          :rounded="linkedStatusRounded"
        />
      </div>
    </div>
  </div>
</template>
