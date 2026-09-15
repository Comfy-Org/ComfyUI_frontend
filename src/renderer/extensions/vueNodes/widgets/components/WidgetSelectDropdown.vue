<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SUPPORTED_EXTENSIONS_ACCEPT } from '@/extensions/core/load3d/constants'
import FormDropdown from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue'
import { AssetKindKey } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import WidgetLayoutField from '@/renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue'
import { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import { useWidgetSelectActions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'
import { useWidgetSelectItems } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'
import { parseComboSpecDescriptor } from '@/renderer/extensions/vueNodes/widgets/utils/comboSpecDescriptor'
import type { OwnershipOption } from '@/platform/assets/types/filterTypes'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { pagedItems } from '@/utils/pagedList'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const props = defineProps<{
  widget: SimplifiedWidget<string | undefined>
  isAssetMode?: boolean
}>()

const descriptor = computed(() => {
  const spec = props.widget.spec
  return parseComboSpecDescriptor(
    spec && isComboInputSpec(spec) ? spec : undefined
  )
})

const assetKind = computed(() => descriptor.value.kind)

provide(AssetKindKey, assetKind)

const modelValue = defineModel<string | undefined>({
  default({ widget }: { widget?: SimplifiedWidget<string | undefined> }) {
    const values = widget?.options?.values
    return Array.isArray(values) ? values[0] : undefined
  }
})

const { t } = useI18n()

const combinedProps = computed(() =>
  filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS)
)

const getAssetData = () => {
  if (!props.isAssetMode) return null
  return useAssetWidgetData(() => props.widget.options?.nodeType)
}

const filterSelected = ref('all')
const ownershipSelected = ref<OwnershipOption>('all')
const baseModelSelected = ref<Set<string>>(new Set())

const {
  dropdownItems,
  filterOptions,
  ownershipOptions,
  baseModelOptions,
  selectedSet
} = useWidgetSelectItems({
  getOptionLabel: () => props.widget.options?.getOptionLabel,
  modelValue,
  assetKind,
  assetData: getAssetData(),
  isAssetMode: () => props.isAssetMode ?? false,
  filterSelected,
  ownershipSelected,
  baseModelSelected
})

const { updateSelectedItems, handleFilesUpdate } = useWidgetSelectActions({
  modelValue,
  dropdownItems: () => pagedItems(dropdownItems.value),
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
      v-model:ownership-selected="ownershipSelected"
      v-model:base-model-selected="baseModelSelected"
      :layout-mode="props.isAssetMode ? 'list' : 'grid'"
      :selected="selectedSet"
      :items="dropdownItems"
      :placeholder="mediaPlaceholder"
      :multiple="false"
      :uploadable="!props.isAssetMode && descriptor.allowUpload"
      :accept="acceptTypes"
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
