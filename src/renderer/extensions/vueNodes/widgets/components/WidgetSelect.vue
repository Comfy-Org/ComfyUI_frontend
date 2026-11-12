<template>
  <WidgetSelectDropdown
    v-if="isDropdownUIWidget"
    v-model="modelValue"
    :widget
    :node-type="widget.nodeType ?? nodeType"
    :asset-kind
    :allow-upload
    :upload-folder
    :upload-subfolder
    :is-asset-mode
    :default-layout-mode
  />
  <WidgetWithControl
    v-else-if="widget.controlWidget"
    v-model="modelValue"
    :component="WidgetSelectDefault"
    :widget="widget as SelectControlWidget"
    :widget-id="props.widgetId"
    :filename-summary
  />
  <WidgetSelectDefault
    v-else
    v-model="modelValue"
    :widget
    :widget-id="props.widgetId"
    :filename-summary
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { assetService } from '@/platform/assets/services/assetService'
import WidgetSelectDefault from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue'
import WidgetSelectDropdown from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue'
import WidgetWithControl from '@/renderer/extensions/vueNodes/widgets/components/WidgetWithControl.vue'
import type { LayoutMode } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import { parseComboSpecDescriptor } from '@/renderer/extensions/vueNodes/widgets/utils/comboSpecDescriptor'
import type { ResultItemType } from '@comfyorg/api-client/resultItemTypeSchema'
import { isComboInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { ComboInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type {
  SimplifiedControlWidget,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

type SelectControlWidget = SimplifiedControlWidget<WidgetValue>

const props = defineProps<{
  widget: SimplifiedWidget<string | undefined>
  widgetId?: WidgetId
  nodeType?: string
}>()

const modelValue = defineModel<WidgetValue>()
const filenameSummary = computed(() =>
  assetService.isAssetBrowserEligible(
    props.widget.nodeType ?? props.nodeType ?? '',
    props.widget.name
  )
)

const comboSpec = computed<ComboInputSpec | undefined>(() => {
  if (props.widget.spec && isComboInputSpec(props.widget.spec)) {
    return props.widget.spec
  }
  return undefined
})

const specDescriptor = computed(() => parseComboSpecDescriptor(comboSpec.value))

const isAssetMode = computed(
  () =>
    assetService.shouldUseWidgetAssetPicker(
      props.nodeType,
      props.widget.name
    ) ||
    (assetService.isWidgetAssetPickerEnabled() && props.widget.type === 'asset')
)

const assetKind = computed(() => specDescriptor.value.kind)
const isDropdownUIWidget = computed(
  () => isAssetMode.value || assetKind.value !== 'unknown'
)
const allowUpload = computed(() => specDescriptor.value.allowUpload)
const uploadFolder = computed<ResultItemType>(() => {
  return specDescriptor.value.folder ?? 'input'
})
const uploadSubfolder = computed(() => specDescriptor.value.subfolder)
const defaultLayoutMode = computed<LayoutMode>(() => {
  return isAssetMode.value ? 'list' : 'grid'
})
</script>
