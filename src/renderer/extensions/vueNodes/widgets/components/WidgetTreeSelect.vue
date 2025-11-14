<template>
  <WidgetLayoutField :widget="widget">
    <TreeSelect
      v-model="localValue"
      v-bind="combinedProps"
      class="w-full text-xs"
      :aria-label="widget.name"
      size="small"
      :pt="{
        dropdownIcon: 'text-component-node-foreground-secondary'
      }"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import TreeSelect from 'primevue/treeselect'
import { computed } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import { isTreeSelectInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

export type TreeNode = {
  key: string
  label?: string
  data?: unknown
  children?: TreeNode[]
  leaf?: boolean
  selectable?: boolean
}

const props = defineProps<{
  widget: SimplifiedWidget<any>
  modelValue: any
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: null,
  emit
})

// Transform compatibility props for overlay positioning
const transformCompatProps = useTransformCompatOverlayProps()

// TreeSelect specific excluded props
const TREE_SELECT_EXCLUDED_PROPS = [
  ...PANEL_EXCLUDED_PROPS,
  'inputClass',
  'inputStyle'
] as const

const combinedProps = computed(() => {
  const spec = props.widget.spec
  if (!spec || !isTreeSelectInputSpec(spec)) {
    return {
      ...filterWidgetProps(props.widget.options, TREE_SELECT_EXCLUDED_PROPS),
      ...transformCompatProps.value
    }
  }

  const specOptions = spec.options || {}
  return {
    // Include runtime props like disabled, but filter out panel-related ones
    ...filterWidgetProps(props.widget.options, TREE_SELECT_EXCLUDED_PROPS),
    // PrimeVue TreeSelect expects 'options' to be an array of tree nodes
    options: (specOptions.values as TreeNode[]) || [],
    // Convert 'multiple' to PrimeVue's 'selectionMode'
    selectionMode: specOptions.multiple
      ? ('multiple' as const)
      : ('single' as const),
    // Pass through other props like placeholder
    placeholder: specOptions.placeholder,
    ...transformCompatProps.value
  }
})
</script>
