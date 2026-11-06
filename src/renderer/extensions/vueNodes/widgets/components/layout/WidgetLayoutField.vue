<script setup lang="ts">
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

import WidgetLayoutFieldLabel from './WidgetLayoutFieldLabel.vue'

const { widget, rootClass, valueText, inputId, fullWidthControl, noBorder } =
  defineProps<{
    widget: Pick<
      SimplifiedWidget<string | number | undefined>,
      'name' | 'label' | 'displayLabel' | 'borderStyle'
    >
    rootClass?: string
    valueText?: string
    inputId?: string
    fullWidthControl?: boolean
    noBorder?: boolean
    fillWidth?: boolean
  }>()

const rowClass = computed(() =>
  cn(
    'relative isolate flex min-w-0 items-center rounded-md bg-input focus-within:ring focus-within:ring-ring **:focus-visible:ring-0 **:focus-visible:outline-none',
    fullWidthControl && 'py-2',
    !noBorder && widget.borderStyle,
    rootClass
  )
)
const controlClass = computed(() =>
  cn(
    'col-start-1 row-start-1 min-w-0 cursor-[inherit] rounded-md transition-all',
    fullWidthControl && 'absolute inset-0'
  )
)
</script>

<template>
  <div :class="rowClass" @pointerdown.stop @pointermove.stop @pointerup.stop>
    <label
      v-if="inputId"
      :for="inputId"
      aria-hidden="true"
      data-testid="widget-row-hit-area"
      class="absolute inset-0 -z-10 cursor-[inherit]"
    />
    <slot name="leading" />
    <WidgetLayoutFieldLabel
      :widget
      :input-id
      :class="cn($slots.leading ? 'pl-2' : 'pl-3', fullWidthControl && 'z-10')"
    />
    <slot name="between" />
    <div :class="cn('ml-auto grid min-w-0 shrink', fillWidth && 'flex-1')">
      <span
        v-if="valueText !== undefined"
        aria-hidden="true"
        :data-value="valueText"
        :class="
          cn(
            'invisible col-start-1 row-start-1 truncate pl-2 after:content-[attr(data-value)]',
            fullWidthControl ? 'pr-2' : 'pr-7'
          )
        "
      />
      <div :class="controlClass">
        <slot :border-style="widget.borderStyle" />
      </div>
    </div>
  </div>
</template>
