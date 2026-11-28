<script setup lang="ts">
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField, useWidgetHeight } from '@/types/widgetTypes'
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

const hideLayoutField = useHideLayoutField()
</script>

<template>
  <div
    :class="
      cn(
        'relative isolate flex min-w-0 items-center rounded-(--node-widget-radius) border-(length:--node-widget-border-width) border-node-border bg-input focus-within:ring focus-within:ring-ring **:focus-visible:ring-0 **:focus-visible:outline-none',
        fullWidthControl ? 'py-2' : useWidgetHeight(),
        !noBorder && widget.borderStyle,
        rootClass
      )
    "
    data-part="widget-field"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <label
      v-if="inputId && !hideLayoutField"
      :for="inputId"
      aria-hidden="true"
      data-testid="widget-row-hit-area"
      class="absolute inset-0 -z-10 cursor-[inherit]"
    />
    <slot name="leading" />
    <WidgetLayoutFieldLabel
      :widget
      :input-id
      :data-leading="$slots.leading ? '' : undefined"
      :class="cn($slots.leading ? 'pl-2' : 'pl-3', fullWidthControl && 'z-10')"
    />
    <slot name="between" />
    <div
      :data-value="valueText"
      :class="
        cn(
          'ml-auto grid min-w-0 shrink *:col-start-1 *:row-start-1 *:min-w-0',
          fillWidth && 'flex-1',
          valueText !== undefined &&
            'before:invisible before:col-start-1 before:row-start-1 before:truncate before:pl-2 before:content-[attr(data-value)]',
          valueText !== undefined &&
            (fullWidthControl ? 'before:pr-2' : 'before:pr-7')
        )
      "
    >
      <slot :border-style="widget.borderStyle" />
    </div>
  </div>
</template>
