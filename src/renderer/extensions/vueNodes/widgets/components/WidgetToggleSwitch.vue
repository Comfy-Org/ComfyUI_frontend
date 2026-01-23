<template>
  <WidgetLayoutField :widget>
    <div
      :class="
        cn('flex w-fit items-center gap-2', { 'ml-auto': !hideLayoutField })
      "
    >
      <span
        v-if="stateLabel"
        :class="
          cn(
            'text-sm transition-colors',
            modelValue
              ? 'text-node-component-slot-text'
              : 'text-node-component-slot-text/50'
          )
        "
      >
        {{ stateLabel }}
      </span>
      <ToggleSwitch
        v-model="modelValue"
        v-bind="filteredProps"
        :aria-label="widget.name"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, inject } from 'vue'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widget } = defineProps<{
  widget: SimplifiedWidget<boolean, IWidgetOptions>
}>()

const modelValue = defineModel<boolean>()

const hideLayoutField = inject<boolean>('hideLayoutField', false)

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, STANDARD_EXCLUDED_PROPS)
)

const stateLabel = computed(() => {
  const options = widget.options
  if (!options?.on && !options?.off) return null
  return modelValue.value ? (options.on ?? 'true') : (options.off ?? 'false')
})
</script>
