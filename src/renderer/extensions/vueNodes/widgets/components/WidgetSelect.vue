<template>
  <WidgetSelectDropdown
    v-if="isDropdownUIWidget"
    v-model="modelValue"
    :widget
    :node-type="widget.nodeType ?? nodeType"
    :asset-kind="assetKind"
    :allow-upload="allowUpload"
    :upload-folder="uploadFolder"
    :upload-subfolder="uploadSubfolder"
    :is-asset-mode="isAssetMode"
    :default-layout-mode="defaultLayoutMode"
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
import type { LayoutMode } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import { resolveWidgetSelectMode } from '@/renderer/extensions/vueNodes/widgets/utils/widgetSelectMode'
import type { ResultItemType } from '@/schemas/apiSchema'
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

const modelValue = defineModel<WidgetValue>()

const mode = computed(() =>
  resolveWidgetSelectMode(props.widget, {
    assetApiEnabled: assetService.isAssetAPIEnabled(),
    useAssetBrowser: assetService.shouldUseAssetBrowser(
      props.nodeType,
      props.widget.name
    )
  })
)

const assetKind = computed(() => mode.value.assetKind)
const isAssetMode = computed(() => mode.value.isAssetMode)
const isDropdownUIWidget = computed(() => mode.value.isDropdownUIWidget)
const allowUpload = computed(() => mode.value.allowUpload)
const uploadFolder = computed<ResultItemType>(() => {
  return mode.value.uploadFolder ?? 'input'
})
const uploadSubfolder = computed(() => mode.value.uploadSubfolder)
const defaultLayoutMode = computed<LayoutMode>(() => {
  return isAssetMode.value ? 'list' : 'grid'
})
</script>
