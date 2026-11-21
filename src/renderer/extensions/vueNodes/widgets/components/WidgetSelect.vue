<template>
  <WidgetSelectDropdown
    v-if="isDropdownUIWidget"
    v-model="modelValue"
    :widget-id
    :display-label
    :node-type
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
    :widget-id
    :display-label
    :filename-summary
  />
  <WidgetSelectDefault
    v-else
    v-model="modelValue"
    :widget-id
    :display-label
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
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'
import { parseComboSpecDescriptor } from '@/renderer/extensions/vueNodes/widgets/utils/comboSpecDescriptor'
import type { ResultItemType } from '@comfyorg/api-client/resultItemTypeSchema'
import { isComboInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { ComboInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

const { widgetId, displayLabel, nodeType } = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
  nodeType?: string
}>()

const modelValue = defineModel<WidgetValue>()
const widget = useWidgetView(() => widgetId)
const filenameSummary = computed(() =>
  assetService.isAssetBrowserEligible(nodeType ?? '', widget.value.name)
)

const comboSpec = computed<ComboInputSpec | undefined>(() => {
  const spec = widget.value.spec
  return spec && isComboInputSpec(spec) ? spec : undefined
})

const specDescriptor = computed(() => parseComboSpecDescriptor(comboSpec.value))

const isAssetMode = computed(
  () =>
    assetService.shouldUseWidgetAssetPicker(nodeType, widget.value.name) ||
    (assetService.isWidgetAssetPickerEnabled() && widget.value.type === 'asset')
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
