<template>
  <WidgetSelectDropdown
    v-if="isDropdownUIWidget"
    v-model="modelValue"
    :widget
    :is-asset-mode="isAssetMode"
  />
  <WidgetWithControl
    v-else-if="widget.controlWidget"
    v-model="modelValue"
    :component="WidgetSelectDefault"
    :widget="widget as SelectControlWidget"
  />
  <WidgetSelectDefault v-else v-model="modelValue" :widget />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { assetService } from '@/platform/assets/services/assetService'
import WidgetSelectDefault from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue'
import WidgetSelectDropdown from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue'
import WidgetWithControl from '@/renderer/extensions/vueNodes/widgets/components/WidgetWithControl.vue'
import { parseComboSpecDescriptor } from '@/renderer/extensions/vueNodes/widgets/utils/comboSpecDescriptor'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  SimplifiedControlWidget,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'

type SelectControlWidget = SimplifiedControlWidget<WidgetValue>

const props = defineProps<{
  widget: SimplifiedWidget<string | undefined>
  nodeType?: string
}>()

const modelValue = defineModel<string | undefined>()

const isAssetMode = computed(
  () =>
    assetService.shouldUseWidgetAssetPicker(
      props.nodeType,
      props.widget.name
    ) ||
    (assetService.isWidgetAssetPickerEnabled() && props.widget.type === 'asset')
)

const isDropdownUIWidget = computed(() => {
  if (isAssetMode.value) return true

  const spec = props.widget.spec
  return (
    parseComboSpecDescriptor(spec && isComboInputSpec(spec) ? spec : undefined)
      .kind !== 'unknown'
  )
})
</script>
