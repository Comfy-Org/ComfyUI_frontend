<template>
  <WidgetLayoutField :widget="widgetWithStyle">
    <!-- Use ToggleGroup when explicit labels are provided -->
    <ToggleGroup
      v-if="hasLabels"
      type="single"
      :model-value="toggleGroupValue"
      class="ml-auto gap-0 bg-node-component-surface mb-[-0.5rem]"
      @update:model-value="handleToggleGroupChange"
    >
      <ToggleGroupItem
        value="off"
        :aria-label="`${widget.name}: ${labelOff}`"
        class="rounded-l-md rounded-r-none border-0 bg-node-component-border/10 text-node-component-text data-[state=on]:!bg-white data-[state=on]:!text-black hover:bg-node-component-border/20 cursor-pointer h-7"
      >
        {{ labelOff }}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="on"
        :aria-label="`${widget.name}: ${labelOn}`"
        class="rounded-l-none rounded-r-md border-0 bg-node-component-border/10 text-node-component-text data-[state=on]:!bg-white data-[state=on]:!text-black hover:bg-node-component-border/20 cursor-pointer h-7"
      >
        {{ labelOn }}
      </ToggleGroupItem>
    </ToggleGroup>

    <!-- Use ToggleSwitch for implicit boolean states -->
    <ToggleSwitch
      v-else
      v-model="modelValue"
      v-bind="filteredProps"
      class="ml-auto block"
      :aria-label="widget.name"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

interface BooleanWidgetOptions {
  on?: string
  off?: string
  [key: string]: unknown
}

const { widget } = defineProps<{
  widget: SimplifiedWidget<boolean, BooleanWidgetOptions>
}>()

const modelValue = defineModel<boolean>()

const { t } = useI18n()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, STANDARD_EXCLUDED_PROPS)
)

const hasLabels = computed(() => {
  return !!(widget.options?.on || widget.options?.off)
})

const labelOn = computed(() => widget.options?.on ?? t('widgets.boolean.true'))
const labelOff = computed(
  () => widget.options?.off ?? t('widgets.boolean.false')
)

const toggleGroupValue = computed(() => {
  return modelValue.value ? 'on' : 'off'
})

const handleToggleGroupChange = (value: unknown) => {
  if (value === 'on') {
    modelValue.value = true
  } else if (value === 'off') {
    modelValue.value = false
  }
}

// Override WidgetLayoutField styling when using ToggleGroup
const widgetWithStyle = computed(() => ({
  ...widget,
  borderStyle: hasLabels.value
    ? 'focus-within:!ring-0 !bg-transparent !rounded-none focus-within:!outline-none flex justify-end'
    : undefined
}))
</script>
