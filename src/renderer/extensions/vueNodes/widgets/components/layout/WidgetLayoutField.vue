<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
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
const rowElement = useTemplateRef<HTMLDivElement>('rowElement')
const label = computed(() =>
  widget.name ? (widget.displayLabel ?? (widget.label || widget.name)) : ''
)
const rowClass = computed(() =>
  cn(
    'relative isolate flex min-w-0 items-center rounded-md bg-input focus-within:ring focus-within:ring-ring **:focus-visible:ring-0 **:focus-visible:outline-none [&_[data-slot=number-field]:focus-within]:ring-0',
    hasLeadingButton ? 'pl-8' : 'pl-3',
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
  <div
    ref="rowElement"
    :class="rowClass"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <label
      v-if="activateOnClick && inputId"
      :for="inputId"
      aria-hidden="true"
      data-testid="widget-row-hit-area"
      class="absolute inset-0 -z-10 cursor-[inherit]"
    />
    <label
      v-if="!hideLayoutField"
      :for="inputId"
      :title="label"
      :class="
        cn(
          'max-w-fit min-w-0 flex-1 cursor-[inherit] content-center-safe truncate text-node-foreground select-none',
          fullWidthControl && 'z-10',
          labelClass
        )
      "
    >
      <span data-testid="widget-layout-field-label" class="block truncate">
        {{ label }}
      </span>
    </label>
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
        <slot :border-style="widget.borderStyle" :row-element />
      </div>
    </div>
  </div>
</template>
