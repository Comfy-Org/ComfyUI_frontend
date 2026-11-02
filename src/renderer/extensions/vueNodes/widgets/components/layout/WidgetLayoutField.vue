<script setup lang="ts">
import { computed, inject, useTemplateRef } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

const { widget, rootClass, valueText, inputId, labelClass, fullWidthControl } =
  defineProps<{
    widget: Pick<
      SimplifiedWidget<string | number | undefined>,
      'name' | 'label' | 'displayLabel' | 'borderStyle'
    >
    rootClass?: string
    valueText?: string
    inputId?: string
    labelClass?: string
    fullWidthControl?: boolean
    noBorder?: boolean
    fillWidth?: boolean
  }>()

const hideLayoutField = useHideLayoutField()
const unifiedRows = inject(UnifiedWidgetRowsKey, false)
const fullWidthRow = computed(() => unifiedRows && fullWidthControl)
const labelElement = useTemplateRef<HTMLLabelElement>('labelElement')
defineExpose({ labelElement })
const label = computed(() =>
  widget.name ? (widget.displayLabel ?? (widget.label || widget.name)) : ''
)
const borderStyle = computed(() =>
  cn('focus-within:ring focus-within:ring-ring', widget.borderStyle)
)
</script>

<template>
  <div
    :class="
      cn(
        unifiedRows
          ? 'relative flex min-w-0 items-center rounded-md bg-input pl-8 focus-within:ring focus-within:ring-ring'
          : 'grid min-w-0 grid-cols-subgrid justify-between gap-2',
        fullWidthRow && 'py-2 pl-2',
        unifiedRows && !noBorder && widget.borderStyle,
        rootClass
      )
    "
  >
    <label
      v-if="!hideLayoutField"
      ref="labelElement"
      :for="inputId"
      :title="label"
      :class="
        cn(
          'content-center-safe truncate select-none',
          unifiedRows && 'max-w-fit min-w-0 flex-1 text-node-foreground',
          fullWidthRow && 'z-10',
          labelClass
        )
      "
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
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
        v-if="unifiedRows"
        aria-hidden="true"
        :data-value="valueText"
        :class="
          cn(
            'invisible col-start-1 row-start-1 truncate pl-2 after:content-[attr(data-value)]',
            fullWidthRow ? 'pr-2' : 'pr-7'
          )
        "
      />
      <div
        :class="
          cn(
            'min-w-0 cursor-default rounded-md transition-all',
            !noBorder && !unifiedRows && borderStyle,
            unifiedRows && 'col-start-1 row-start-1',
            fullWidthRow && 'absolute inset-0'
          )
        "
        @pointerdown.stop
        @pointermove.stop
        @pointerup.stop
      >
        <slot :border-style />
      </div>
    </div>
  </div>
</template>
