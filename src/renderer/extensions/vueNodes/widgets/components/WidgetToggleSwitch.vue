<template>
  <WidgetLayoutField :widget>
    <!-- Use FormSelectButton when explicit labels are provided -->
    <FormSelectButton
      v-if="hasLabels"
      v-bind="filteredProps"
      :model-value="modelValue ? 'on' : 'off'"
      :options="booleanOptions"
      option-label="label"
      option-value="value"
      :class="cn(hideLayoutField || 'ml-auto')"
      @update:model-value="handleOptionChange"
    />

    <!-- Use ToggleSwitch for implicit boolean states -->
    <div
      v-else
      :class="cn('flex w-fit items-center gap-2', hideLayoutField || 'ml-auto')"
    >
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@/utils/tailwindUtil'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import FormSelectButton from './form/FormSelectButton.vue'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widget } = defineProps<{
  widget: SimplifiedWidget<boolean, IWidgetOptions>
}>()

const modelValue = defineModel<boolean>()

const hideLayoutField = useHideLayoutField()
const { t } = useI18n()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, STANDARD_EXCLUDED_PROPS)
)

const hasLabels = computed(() => {
  return widget.options?.on != null || widget.options?.off != null
})

const booleanOptions = computed(() => [
  { label: widget.options?.off ?? t('widgets.boolean.false'), value: 'off' },
  { label: widget.options?.on ?? t('widgets.boolean.true'), value: 'on' }
])

function handleOptionChange(value: string) {
  modelValue.value = value === 'on'
}
</script>
