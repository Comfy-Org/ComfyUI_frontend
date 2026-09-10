<script setup lang="ts">
import { computed, provide, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { SUPPORTED_EXTENSIONS_ACCEPT } from '@/extensions/core/load3d/constants'
import FormDropdown from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue'
import { AssetKindKey } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { LayoutMode } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import WidgetLayoutField from '@/renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue'
import { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import { useWidgetSelectActions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'
import { useWidgetSelectItems } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'
import { parseComboSpecDescriptor } from '@/renderer/extensions/vueNodes/widgets/utils/comboSpecDescriptor'
import type { OwnershipOption } from '@/platform/assets/types/filterTypes'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useAssetsStore } from '@/stores/assetsStore'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

interface Props {
  widget: SimplifiedWidget<string | undefined>
  nodeType?: string
  isAssetMode?: boolean
}

const props = defineProps<Props>()

const descriptor = computed(() => {
  const spec = props.widget.spec
  return parseComboSpecDescriptor(
    spec && isComboInputSpec(spec) ? spec : undefined
  )
})
const assetKind = computed(() => descriptor.value.kind)

provide(AssetKindKey, assetKind)

const modelValue = defineModel<WidgetValue>({
  default(modelProps: Record<string, unknown>) {
    const modelWidget = modelProps.widget as Props['widget'] | undefined
    const values = modelWidget?.options?.values
    return (Array.isArray(values) ? values[0] : undefined) ?? ''
  }
})
const stringModelValue = computed({
  get: () => {
    const value = modelValue.value
    return value == null ? undefined : String(value)
  },
  set: (value: string | undefined) => {
    modelValue.value = value
  }
})

const { t } = useI18n()
const outputAssets = useAssetsStore().outputAssets

const combinedProps = computed(() =>
  filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS)
)

const getAssetData = () => {
  const nodeType: string | undefined =
    props.widget.options?.nodeType ?? props.nodeType
  if (props.isAssetMode && nodeType) {
    return useAssetWidgetData(toRef(nodeType))
  }
  return null
}
const assetData = getAssetData()

const filterSelected = ref('all')
const ownershipSelected = ref<OwnershipOption>('all')
const baseModelSelected = ref<Set<string>>(new Set())

const {
  dropdownItems,
  filterOptions,
  showOwnershipFilter,
  ownershipOptions,
  showBaseModelFilter,
  baseModelOptions,
  selectedSet
} = useWidgetSelectItems({
  values: () => props.widget.options?.values as unknown[] | undefined,
  getOptionLabel: () => props.widget.options?.getOptionLabel,
  modelValue: stringModelValue,
  assetKind,
  outputMediaAssets: outputAssets,
  assetData,
  isAssetMode: () => props.isAssetMode,
  filterSelected,
  ownershipSelected,
  baseModelSelected
})

const { updateSelectedItems, handleFilesUpdate } = useWidgetSelectActions({
  modelValue: stringModelValue,
  dropdownItems,
  widget: () => props.widget,
  uploadFolder: () => descriptor.value.folder ?? 'input',
  uploadSubfolder: () => descriptor.value.subfolder
})

const mediaPlaceholder = computed(() => {
  const options = props.widget.options

  if (options?.placeholder) {
    return options.placeholder
  }

  switch (assetKind.value) {
    case 'image':
      return t('widgets.uploadSelect.placeholderImage')
    case 'video':
      return t('widgets.uploadSelect.placeholderVideo')
    case 'audio':
      return t('widgets.uploadSelect.placeholderAudio')
    case 'mesh':
      return t('widgets.uploadSelect.placeholderMesh')
    case 'model':
      return t('widgets.uploadSelect.placeholderModel')
    case 'unknown':
      return t('widgets.uploadSelect.placeholderUnknown')
  }

  return t('widgets.uploadSelect.placeholder')
})

const uploadable = computed(() => {
  if (props.isAssetMode) return false
  return descriptor.value.allowUpload
})

const acceptTypes = computed(() => {
  // Be permissive with accept types because backend uses libraries
  // that can handle a wide range of formats
  switch (assetKind.value) {
    case 'image':
      return 'image/*,.exr'
    case 'video':
      return 'video/*'
    case 'audio':
      return 'audio/*'
    case 'mesh':
      return SUPPORTED_EXTENSIONS_ACCEPT
    default:
      return undefined
  }
})

const layoutMode = ref<LayoutMode>(props.isAssetMode ? 'list' : 'grid')

const isUploading = ref(false)
async function updateFiles(files: File[]) {
  isUploading.value = true
  await handleFilesUpdate(files)
  isUploading.value = false
}
</script>

<template>
  <WidgetLayoutField :widget>
    <FormDropdown
      v-model:filter-selected="filterSelected"
      v-model:layout-mode="layoutMode"
      v-model:ownership-selected="ownershipSelected"
      v-model:base-model-selected="baseModelSelected"
      :selected="selectedSet"
      :items="dropdownItems"
      :placeholder="mediaPlaceholder"
      :multiple="false"
      :uploadable
      :accept="acceptTypes"
      :filter-options
      :show-ownership-filter
      :ownership-options
      :show-base-model-filter
      :base-model-options
      :is-uploading
      v-bind="combinedProps"
      class="w-full"
      @update:selected="updateSelectedItems"
      @update:files="updateFiles"
    />
  </WidgetLayoutField>
</template>
