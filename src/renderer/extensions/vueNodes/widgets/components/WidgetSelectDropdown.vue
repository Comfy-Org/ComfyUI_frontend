<script setup lang="ts">
import { computed, ref, toRef, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { SUPPORTED_EXTENSIONS_ACCEPT } from '@comfyorg/viewport3d/load3d/constants'
import FormDropdown from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue'
import type { LayoutMode } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import WidgetLayoutField from '@/renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue'
import { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import { useWidgetSelectActions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'
import { useWidgetSelectItems } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'
import type { ResultItemType } from '@comfyorg/api-client/resultItemTypeSchema'
import type { OwnershipOption } from '@/platform/assets/types/filterTypes'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import type { AssetKind } from '@/types/widgetTypes'
import { pagedItems } from '@/utils/pagedList'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

interface Props {
  widget: SimplifiedWidget<string | undefined>
  nodeType?: string
  assetKind?: AssetKind
  allowUpload?: boolean
  uploadFolder?: ResultItemType
  uploadSubfolder?: string
  isAssetMode?: boolean
  defaultLayoutMode?: LayoutMode
}

const props = defineProps<Props>()
const inputId = useId()

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
  dropdownItems: items,
  filterOptions,
  ownershipOptions,
  baseModelOptions,
  selectedSet: selected
} = useWidgetSelectItems({
  getOptionLabel: () => props.widget.options?.getOptionLabel,
  modelValue: stringModelValue,
  assetKind: () => props.assetKind,
  assetData,
  isAssetMode: () => props.isAssetMode ?? false,
  filterSelected,
  ownershipSelected,
  baseModelSelected
})

const { updateSelectedItems, handleFilesUpdate } = useWidgetSelectActions({
  dropdownItems: () => pagedItems(items.value),
  locatorId: props.widget.nodeLocatorId,
  modelValue: stringModelValue,
  uploadFolder: () => props.uploadFolder,
  uploadSubfolder: () => props.uploadSubfolder,
  widget: () => props.widget
})

const placeholder = computed(() => {
  const options = props.widget.options

  if (options?.placeholder) {
    return options.placeholder
  }

  switch (props.assetKind) {
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
  return props.allowUpload === true
})

const accept = computed(() => {
  switch (props.assetKind) {
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

const layoutMode = ref<LayoutMode>(props.defaultLayoutMode ?? 'grid')

const isUploading = ref(false)
async function updateFiles(files: File[]) {
  isUploading.value = true
  await handleFilesUpdate(files)
  isUploading.value = false
}
</script>

<template>
  <WidgetLayoutField :widget :input-id root-class="h-auto">
    <FormDropdown
      v-model:filter-selected="filterSelected"
      v-model:layout-mode="layoutMode"
      v-model:ownership-selected="ownershipSelected"
      v-model:base-model-selected="baseModelSelected"
      :input-id
      :selected
      :items
      :placeholder
      :multiple="false"
      :uploadable
      :accept
      :filter-options
      :show-ownership-filter="props.isAssetMode"
      :ownership-options
      :show-base-model-filter="props.isAssetMode"
      :base-model-options
      :is-uploading
      v-bind="combinedProps"
      class="w-full"
      @update:selected="updateSelectedItems"
      @update:files="updateFiles"
    />
  </WidgetLayoutField>
</template>
