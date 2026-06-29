<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, provide, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useLoadVideoPreview } from '@/composables/video/useLoadVideoPreview'
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
import type { NodeId } from '@/lib/litegraph/src/litegraph'
import type { ResultItemType } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { AssetKind } from '@/types/widgetTypes'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

interface Props {
  widget: SimplifiedWidget<string | undefined>
  nodeId?: NodeId
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
      return props.nodeType === 'LoadVideo'
        ? t('widgets.uploadSelect.browseAssetLibrary')
        : t('widgets.uploadSelect.placeholderVideo')
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
  if (props.nodeType === 'LoadVideo') return false
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

function handleIsOpenUpdate(isOpen: boolean) {
  if (isOpen && !outputMediaAssets.loading.value) {
    void outputMediaAssets.refresh()
  }
}

const handleApproachEnd = useDebounceFn(async () => {
  if (
    outputMediaAssets.hasMore.value &&
    !outputMediaAssets.loading.value &&
    !outputMediaAssets.isLoadingMore.value
  ) {
    await outputMediaAssets.loadMore()
  }
}, 300)

const isUploading = ref(false)

const node = computed(() => {
  if (!props.nodeId) return undefined
  return app.canvas.graph?.getNodeById(props.nodeId)
})

const { videoUrl: loadVideoPreviewUrl } = useLoadVideoPreview(node)

const nodeIsUploading = computed(() => node.value?.isUploading ?? false)

const awaitingVideoPreview = computed(() => {
  if (props.nodeType !== 'LoadVideo' || props.assetKind !== 'video') {
    return false
  }
  if (!modelValue.value) return false
  if (!node.value) return false
  return !loadVideoPreviewUrl.value
})

const isLoadVideoProcessing = computed(
  () =>
    props.nodeType === 'LoadVideo' &&
    props.assetKind === 'video' &&
    (nodeIsUploading.value || awaitingVideoPreview.value)
)

const dropdownDisabled = computed(() => isLoadVideoProcessing.value)

const dropdownIsUploading = computed(
  () => isUploading.value || isLoadVideoProcessing.value
)

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
      :display-items="displayItems"
      :placeholder="mediaPlaceholder"
      :multiple="false"
      :uploadable
      :disabled="dropdownDisabled"
      :accept="acceptTypes"
      :filter-options
      :show-ownership-filter
      :ownership-options
      :show-base-model-filter
      :base-model-options
      :is-uploading="dropdownIsUploading"
      v-bind="combinedProps"
      :loading-more="outputMediaAssets.isLoadingMore.value"
      class="w-full"
      @update:selected="updateSelectedItems"
      @update:files="updateFiles"
      @update:is-open="handleIsOpenUpdate"
      @approach-end="handleApproachEnd"
    />
  </WidgetLayoutField>
</template>
