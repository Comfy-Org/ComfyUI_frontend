<script setup lang="ts">
import { computed, inject, ref, useTemplateRef } from 'vue'

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
  fullWidthControl,
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
defineExpose({ labelElement, rowElement })
const editingValue = ref<string>()
const label = computed(() =>
  widget.name ? (widget.displayLabel ?? (widget.label || widget.name)) : ''
)
const borderStyle = computed(() =>
  cn(
    !unifiedRows && 'focus-within:ring focus-within:ring-ring',
    widget.borderStyle
  )
)

function measureInput(event: Event) {
  if (event.target instanceof HTMLInputElement && event.target.type === 'text')
    editingValue.value = event.target.value
}

function activateControl(event: MouseEvent) {
  if (!unifiedRows || !activateOnClick || !inputId || event.defaultPrevented)
    return
  if (
    event.target instanceof Element &&
    event.target.closest(
      'label, button, input, textarea, select, a, [role="slider"]'
    )
  )
    return

  const control = document.getElementById(inputId)
  if (!control || control.matches(':disabled, [aria-disabled="true"]')) return

  control.focus()
  control.click()
}
</script>

<template>
  <div
    ref="rowElement"
    :class="
      cn(
        unifiedRows
          ? 'relative flex min-w-0 items-center rounded-md bg-input pl-8 focus-within:ring focus-within:ring-ring **:focus-visible:ring-0 **:focus-visible:outline-none [&_[data-slot=number-field]:focus-within]:ring-0'
          : 'grid min-w-0 grid-cols-subgrid justify-between gap-2',
        fullWidthRow && 'py-2 pl-2',
        unifiedRows && !noBorder && widget.borderStyle,
        rootClass
      )
    "
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @input="measureInput"
    @focusout="editingValue = undefined"
    @keyup.enter="editingValue = undefined"
    @click="activateControl"
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
        :data-value="editingValue ?? valueText"
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
      >
        <slot :border-style />
      </div>
    </div>
  </div>
</template>
