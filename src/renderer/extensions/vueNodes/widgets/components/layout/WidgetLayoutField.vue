<script setup lang="ts">
import { computed, inject } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

const { widget, rootClass, valueText } = defineProps<{
  widget: Pick<
    SimplifiedWidget<string | number | undefined>,
    'name' | 'label' | 'displayLabel' | 'borderStyle'
  >
  rootClass?: string
  valueText?: string
  noBorder?: boolean
}>()

const hideLayoutField = useHideLayoutField()
const unifiedRows = inject(UnifiedWidgetRowsKey, false)
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
        unifiedRows && !noBorder && widget.borderStyle,
        rootClass
      )
    "
  >
    <div
      v-if="!hideLayoutField"
      :title="widget.displayLabel ?? (widget.label || widget.name)"
      :class="
        cn(
          'content-center-safe truncate',
          unifiedRows && 'max-w-fit min-w-0 flex-1 text-muted-foreground'
        )
      "
    >
      <span
        data-testid="widget-layout-field-label"
        :class="unifiedRows && 'block truncate'"
      >
        <template v-if="widget.name">
          {{ widget.displayLabel ?? (widget.label || widget.name) }}
        </template>
      </span>
    </div>
    <slot name="between" />
    <div
      :class="
        cn('min-w-0', unifiedRows ? 'ml-auto grid shrink' : 'relative flex-1')
      "
    >
      <span
        v-if="unifiedRows"
        aria-hidden="true"
        :data-value="valueText"
        class="invisible col-start-1 row-start-1 truncate pr-7 pl-2 after:content-[attr(data-value)]"
      />
      <div
        :class="
          cn(
            'min-w-0 cursor-default rounded-md transition-all',
            !noBorder && !unifiedRows && borderStyle,
            unifiedRows &&
              'col-start-1 row-start-1 [&_button[role=combobox]_span]:text-right [&_input]:text-right [&_input]:not-disabled:bg-transparent [&>div]:not-disabled:bg-transparent'
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
