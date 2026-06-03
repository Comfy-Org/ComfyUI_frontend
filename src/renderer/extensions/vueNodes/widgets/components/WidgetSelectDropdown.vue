<script setup lang="ts">
import { computed, provide, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRecentlyUsedModels } from '@/composables/sidebarTabs/useRecentlyUsedModels'
import { SUPPORTED_EXTENSIONS_ACCEPT } from '@/extensions/core/load3d/constants'
import { useAssetsApi } from '@/platform/assets/composables/media/useAssetsApi'
import { useFlatOutputAssets } from '@/platform/assets/composables/media/useFlatOutputAssets'
import { isCloud } from '@/platform/distribution/types'
import FormDropdown from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue'
import { AssetKindKey } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { LayoutMode } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import WidgetLayoutField from '@/renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue'
import { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import { useWidgetSelectActions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'
import { useWidgetSelectItems } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'
import {
  getDefaultSortOptions,
  getModelSortOptions
} from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/shared'
import type { ResultItemType } from '@/schemas/apiSchema'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { AssetKind } from '@/types/widgetTypes'
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

provide(
  AssetKindKey,
  computed(() => props.assetKind)
)

const modelValue = defineModel<string | undefined>({
  default(props: Props) {
    const values = props.widget.options?.values
    return (Array.isArray(values) ? values[0] : undefined) ?? ''
  }
})

const { t } = useI18n()

const outputMediaAssets = isCloud
  ? useFlatOutputAssets()
  : useAssetsApi('output')

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

const {
  dropdownItems,
  displayItems,
  filterSelected,
  filterOptions,
  ownershipSelected,
  showOwnershipFilter,
  ownershipOptions,
  baseModelSelected,
  showBaseModelFilter,
  baseModelOptions,
  selectedSet
} = useWidgetSelectItems({
  values: () => props.widget.options?.values as unknown[] | undefined,
  getOptionLabel: () => props.widget.options?.getOptionLabel,
  modelValue,
  assetKind: () => props.assetKind,
  outputMediaAssets,
  assetData,
  isAssetMode: () => props.isAssetMode
})

const { updateSelectedItems, handleFilesUpdate } = useWidgetSelectActions({
  modelValue,
  dropdownItems,
  widget: () => props.widget,
  uploadFolder: () => props.uploadFolder,
  uploadSubfolder: () => props.uploadSubfolder
})

const mediaPlaceholder = computed(() => {
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

const acceptTypes = computed(() => {
  // Be permissive with accept types because backend uses libraries
  // that can handle a wide range of formats
  switch (props.assetKind) {
    case 'image':
      return 'image/*'
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

const isModel = computed(() => props.assetKind === 'model')

// Models sort/group by base model; other pickers use the recency/name options.
// Local builds lack reliable base-model metadata, so they drop the base-model
// sort and list A-Z like the sidebar.
const sortOptions = computed(() => {
  if (!isModel.value) return getDefaultSortOptions()
  const options = getModelSortOptions()
  if (isCloud) return options
  return options.filter(
    (option) =>
      option.id !== 'base-model-asc' && option.id !== 'base-model-desc'
  )
})
// Cloud models default to base-model grouping; local defaults to A-Z.
const sortSelected = ref(
  isModel.value ? (isCloud ? 'base-model-asc' : 'name-asc') : 'default'
)

// Surface recently-picked models at the top of the grouped model picker.
const { topNames, markUsed } = useRecentlyUsedModels()
const pinTopNames = computed(() => (isModel.value ? topNames() : undefined))
watch(modelValue, (value) => {
  if (isModel.value && value) markUsed(value)
})

function handleIsOpenUpdate(isOpen: boolean) {
  if (isOpen && !outputMediaAssets.loading.value) {
    void outputMediaAssets.refresh()
  }
}
</script>

<template>
  <WidgetLayoutField :widget>
    <FormDropdown
      v-model:filter-selected="filterSelected"
      v-model:layout-mode="layoutMode"
      v-model:sort-selected="sortSelected"
      v-model:ownership-selected="ownershipSelected"
      v-model:base-model-selected="baseModelSelected"
      :selected="selectedSet"
      :items="dropdownItems"
      :display-items="displayItems"
      :placeholder="mediaPlaceholder"
      :multiple="false"
      :uploadable
      :accept="acceptTypes"
      :filter-options
      :sort-options="sortOptions"
      :show-ownership-filter="isCloud && showOwnershipFilter"
      :ownership-options
      :show-base-model-filter="isCloud && showBaseModelFilter"
      :base-model-options
      :pin-top-names="pinTopNames"
      v-bind="combinedProps"
      class="w-full"
      @update:selected="updateSelectedItems"
      @update:files="handleFilesUpdate"
      @update:is-open="handleIsOpenUpdate"
    />
  </WidgetLayoutField>
</template>
