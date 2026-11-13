import { capitalize } from 'es-toolkit'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { t } from '@/i18n'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { isGeneratedTempOutput } from '@/platform/assets/composables/media/assetMappers'
import {
  filterItemByBaseModels,
  filterItemByOwnership
} from '@/platform/assets/utils/assetFilterUtils'
import {
  getAssetBaseModels,
  getAssetDisplayName,
  getAssetFilename,
  getAssetUrlFilename,
  getOutputSubfolder
} from '@/platform/assets/utils/assetMetadataUtils'
import type {
  FilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetContentUrl } from '@/platform/assets/utils/assetContentUrl'
import { useAssetsStore } from '@/stores/assetsStore'
import type { AssetKind } from '@/types/widgetTypes'
import {
  createAnnotatedPath,
  parseAnnotatedPath
} from '@/utils/createAnnotatedPath'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { isHdrImageFilename, isHdrImageUrl } from '@/utils/hdrFormatUtil'
import { parseImageWidgetValue } from '@/utils/imageUtil'
import { pagedItems, WrappedList } from '@/utils/pagedList'
import type { MaybePaged } from '@/utils/pagedList'

function getDisplayLabel(value: string, getLabel?: (v: string) => string) {
  try {
    return getLabel?.(value) || value
  } catch (e) {
    console.warn('Failed to map value:', e)
    return value
  }
}

function getMediaUrl(
  filename: string,
  type: string,
  assetKind: AssetKind | undefined,
  subfolder?: string
): string {
  if (!['image', 'video', 'audio'].includes(assetKind ?? '')) return ''
  const params = new URLSearchParams({ filename, type })
  if (subfolder) params.set('subfolder', subfolder)
  appendCloudResParam(params, filename)
  return `/api/view?${params}`
}
function assetRoot(asset: AssetItem): 'input' | 'output' | 'temp' | undefined {
  if (isGeneratedTempOutput(asset)) return 'temp'
  for (const testTag of ['input', 'output', 'temp'] as const) {
    if (asset.tags.includes(testTag)) return testTag
  }
}

function getAnnotatedValueMediaUrl(
  value: string,
  assetKind: AssetKind | undefined
): string {
  const { filepath } = parseAnnotatedPath(value)
  if (
    /^[^\\/]:/.test(filepath) ||
    filepath
      .split(/[\\/]/)
      .some((part) => part === '' || part === '.' || part === '..')
  )
    return ''
  const { filename, subfolder, type } = parseImageWidgetValue(value)
  return getMediaUrl(filename, type, assetKind, subfolder)
}

export interface UseWidgetSelectItemsOptions {
  getOptionLabel: MaybeRefOrGetter<((value: string) => string) | undefined>
  modelValue: MaybeRefOrGetter<string | undefined>
  assetKind: MaybeRefOrGetter<AssetKind | undefined>
  assetData: ReturnType<typeof useAssetWidgetData> | null
  isAssetMode: MaybeRefOrGetter<boolean>
  filterSelected: MaybeRefOrGetter<string>
  ownershipSelected: MaybeRefOrGetter<OwnershipOption>
  baseModelSelected: MaybeRefOrGetter<Set<string>>
}

export function useWidgetSelectItems(options: UseWidgetSelectItemsOptions) {
  const { modelValue, assetData } = options

  const missingMediaStore = useMissingMediaStore()
  const missingMediaValues = computed<ReadonlySet<string>>(
    () =>
      new Set(
        missingMediaStore.missingMediaCandidates?.map((c) => c.name) ?? []
      )
  )

  const filterOptions = computed<FilterOption[]>(() => {
    if (toValue(options.isAssetMode)) {
      const categoryName = assetData?.category.value ?? 'All'
      return [{ name: capitalize(categoryName), value: 'all' }]
    }
    return [
      { name: t('g.all'), value: 'all' },
      { name: t('sideToolbar.labels.imported'), value: 'inputs' },
      { name: t('sideToolbar.labels.generated'), value: 'outputs' }
    ]
  })

  const { ownershipOptions, availableBaseModels } = useAssetFilterOptions(
    () => assetData?.assets.value ?? []
  )

  const baseModelOptions = computed<FilterOption[]>(() => {
    if (!toValue(options.isAssetMode) || !assetData) return []
    return availableBaseModels.value
  })

  const baseAssets = computed(() => {
    const assetsStore = useAssetsStore()
    switch (toValue(options.filterSelected)) {
      case 'inputs':
        return assetsStore.inputAssets
      case 'outputs':
        return assetsStore.flatOutputAssets
      default:
        return assetsStore.allAssets
    }
  })

  const missingValueItem = computed<FormDropdownItem | undefined>(() => {
    const currentValue = toValue(modelValue)
    if (!currentValue) return undefined
    const labelFn = toValue(options.getOptionLabel)
    const kind = toValue(options.assetKind)

    if (missingMediaValues.value.has(currentValue)) return undefined
    if (availableItems.value.some((item) => item.name === currentValue))
      return undefined

    return {
      id: `missing-${currentValue}`,
      preview_url:
        toValue(options.isAssetMode) && assetData
          ? ''
          : getAnnotatedValueMediaUrl(currentValue, kind),
      name: currentValue,
      label: getDisplayLabel(currentValue, labelFn)
    }
  })

  function itemNameFor(asset: AssetItem): string {
    if (toValue(options.isAssetMode))
      return asset.loader_path ?? getAssetFilename(asset)
    const filenameForUrl = getAssetUrlFilename(asset)
    const subfolder = getOutputSubfolder(asset)
    const name = subfolder ? `${subfolder}/${filenameForUrl}` : filenameForUrl
    return createAnnotatedPath(name, { rootFolder: assetRoot(asset) })
  }

  function assetToForm(asset: AssetItem): FormDropdownItem {
    const name = itemNameFor(asset)
    const kind = toValue(options.assetKind)
    return {
      id: asset.id,
      name,
      label: getAssetDisplayName(asset),
      preview_url:
        kind === 'mesh'
          ? ''
          : isHdrImageFilename(asset.name)
            ? asset.preview_id
              ? assetContentUrl(asset.preview_id)
              : ([asset.thumbnail_url, asset.preview_url].find(
                  (url) => url && !isHdrImageUrl(url)
                ) ?? '')
            : asset.preview_url || getAnnotatedValueMediaUrl(name, kind),
      is_immutable: asset.is_immutable,
      base_models: getAssetBaseModels(asset)
    }
  }
  const assetItems = computed<FormDropdownItem[]>(() => {
    if (!toValue(options.isAssetMode) || !assetData) return []
    return assetData.assets.value.map(assetToForm)
  })

  const filteredAssetItems = computed<FormDropdownItem[]>(() =>
    filterItemByBaseModels(
      filterItemByOwnership(
        assetItems.value,
        toValue(options.ownershipSelected)
      ),
      toValue(options.baseModelSelected)
    )
  )

  const availableItems = computed<FormDropdownItem[]>(() => {
    if (toValue(options.isAssetMode) && assetData) {
      return filteredAssetItems.value.filter(
        (item) => !missingMediaValues.value.has(item.name)
      )
    }
    const targetKind = toValue(options.assetKind)
    const targetMediaType = targetKind === 'mesh' ? '3D' : targetKind
    const kindFilter = (asset: AssetItem) =>
      asset.metadata?.kind === targetKind ||
      (targetKind === 'image' && isHdrImageFilename(asset.name)) ||
      getMediaTypeFromFilename(asset.name) === targetMediaType

    return pagedItems(baseAssets.value)
      .filter(kindFilter)
      .map(assetToForm)
      .filter((item) => !missingMediaValues.value.has(item.name))
  })

  const dropdownItems = computed<MaybePaged<FormDropdownItem>>(() => {
    const missingItem = missingValueItem.value
    const mapped = missingItem
      ? [missingItem, ...availableItems.value]
      : availableItems.value
    if (toValue(options.isAssetMode) && assetData) return mapped
    const base = baseAssets.value
    return new WrappedList(base, () => mapped)
  })

  const selectedSet = computed<Set<string>>(() => {
    const currentValue = toValue(modelValue)
    if (currentValue === undefined) return new Set()

    const item = pagedItems(dropdownItems.value).find(
      (item) => item.name === currentValue
    )
    return item ? new Set([item.id]) : new Set()
  })

  return {
    dropdownItems,
    filterOptions,
    ownershipOptions,
    baseModelOptions,
    selectedSet
  }
}
