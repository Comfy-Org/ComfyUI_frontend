<script setup lang="ts">
import { computed, inject, useTemplateRef } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

const {
  widget,
  rootClass,
  valueText,
  inputId,
  labelClass,
  hasLeadingButton,
  fullWidthControl,
  noBorder,
  activateOnClick = true
} = defineProps<{
  widget: Pick<
    SimplifiedWidget<string | number | undefined>,
    'name' | 'label' | 'displayLabel' | 'borderStyle'
  >
  rootClass?: string
  valueText?: string
  inputId?: string
  labelClass?: string
  hasLeadingButton?: boolean
  fullWidthControl?: boolean
  noBorder?: boolean
  fillWidth?: boolean
  activateOnClick?: boolean
}>()

const hideLayoutField = useHideLayoutField()
const unifiedRows = inject(UnifiedWidgetRowsKey, false)
const fullWidthRow = computed(() => unifiedRows && fullWidthControl)
const labelElement = useTemplateRef<HTMLLabelElement>('labelElement')
const rowElement = useTemplateRef<HTMLDivElement>('rowElement')
const label = computed(() =>
  widget.name ? (widget.displayLabel ?? (widget.label || widget.name)) : ''
)
const borderStyle = computed(() =>
  cn(
    !unifiedRows && 'focus-within:ring focus-within:ring-ring',
    widget.borderStyle
  )
)
const rowClass = computed(() =>
  cn(
    unifiedRows
      ? 'relative isolate flex min-w-0 items-center rounded-md bg-input focus-within:ring focus-within:ring-ring **:focus-visible:ring-0 **:focus-visible:outline-none [&_[data-slot=number-field]:focus-within]:ring-0'
      : 'grid min-w-0 grid-cols-subgrid justify-between gap-2',
    unifiedRows && (hasLeadingButton ? 'pl-8' : 'pl-3'),
    fullWidthRow.value && 'py-2',
    unifiedRows && !noBorder && widget.borderStyle,
    rootClass
  )
)
const controlClass = computed(() =>
  cn(
    'min-w-0 rounded-md transition-all',
    !noBorder && !unifiedRows && borderStyle.value,
    unifiedRows ? 'col-start-1 row-start-1 cursor-[inherit]' : 'cursor-default',
    fullWidthRow.value && 'absolute inset-0'
  )
)
</script>

<template>
  <div
    ref="rowElement"
    :class="rowClass"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <label
      v-if="unifiedRows && activateOnClick && inputId"
      :for="inputId"
      aria-hidden="true"
      data-testid="widget-row-hit-area"
      class="absolute inset-0 -z-10 cursor-[inherit]"
    />
    <label
      v-if="!hideLayoutField"
      ref="labelElement"
      :for="inputId"
      :title="label"
      :class="
        cn(
          'content-center-safe truncate select-none',
          unifiedRows &&
            'max-w-fit min-w-0 flex-1 cursor-[inherit] text-node-foreground',
          fullWidthRow && 'z-10',
          labelClass
        )
      "
    >
      <span
        data-testid="widget-layout-field-label"
        :class="unifiedRows && 'block truncate'"
      >
        {{ label }}
      </span>
    </label>
    <slot name="between" />
    <div
      :class="
        cn(
          'min-w-0',
          unifiedRows ? 'ml-auto grid shrink' : 'relative flex-1',
          fillWidth && 'flex-1'
        )
      "
    >
      <span
        v-if="unifiedRows && valueText !== undefined"
        aria-hidden="true"
        :data-value="valueText"
        :class="
          cn(
            'invisible col-start-1 row-start-1 truncate pl-2 after:content-[attr(data-value)]',
            fullWidthRow ? 'pr-2' : 'pr-7'
          )
        "
      />
      <div :class="controlClass">
        <slot :border-style :label-element :row-element />
      </div>
    </div>
  </div>
</template>
