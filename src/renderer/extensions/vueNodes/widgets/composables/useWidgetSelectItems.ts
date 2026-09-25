import { capitalize } from 'es-toolkit'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { t } from '@/i18n'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import {
  filterItemByBaseModels,
  filterItemByOwnership
} from '@/platform/assets/utils/assetFilterUtils'
import {
  getAssetBaseModels,
  getAssetDisplayName,
  getAssetUrlFilename
} from '@/platform/assets/utils/assetMetadataUtils'
import type {
  FilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import type { AssetKind } from '@/types/widgetTypes'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { isPaged, pagedItems, WrappedList } from '@/utils/pagedList'
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
  type: 'input' | 'output',
  assetKind: AssetKind | undefined
): string {
  if (!['image', 'video', 'audio'].includes(assetKind ?? '')) return ''
  const params = new URLSearchParams({ filename, type })
  appendCloudResParam(params, filename)
  return `/api/view?${params}`
}
function assetRoot(asset: AssetItem): 'input' | 'output' | 'temp' | undefined {
  for (const testTag of ['input', 'output', 'temp'] as const) {
    if (asset.tags.includes(testTag)) return testTag
  }
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

  const baseAssets = computed<MaybePaged<AssetItem>>(() => {
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

    if (toValue(options.isAssetMode) && assetData) {
      const existsInAssets = assetData.assets.value.some(
        (asset) => itemNameFor(asset) === currentValue
      )
      if (existsInAssets) return undefined

      return {
        id: `missing-${currentValue}`,
        preview_url: '',
        name: currentValue,
        label: getDisplayLabel(currentValue, labelFn)
      }
    }

    if (
      pagedItems(baseAssets.value).some(
        (asset) => itemNameFor(asset) === currentValue
      )
    )
      return undefined

    const isOutput = currentValue.endsWith(' [output]')
    const strippedValue = isOutput
      ? currentValue.replace(' [output]', '')
      : currentValue

    return {
      id: `missing-${currentValue}`,
      preview_url: getMediaUrl(
        strippedValue,
        isOutput ? 'output' : 'input',
        kind
      ),
      name: currentValue,
      label: getDisplayLabel(currentValue, labelFn)
    }
  })

  function itemNameFor(asset: AssetItem): string {
    const filenameForUrl = getAssetUrlFilename(asset)
    const subfolder =
      toValue(options.assetKind) === 'mesh'
        ? getOutputAssetMetadata(asset.user_metadata)?.subfolder
        : undefined
    const name = subfolder ? `${subfolder}/${filenameForUrl}` : filenameForUrl
    return createAnnotatedPath(name, { rootFolder: assetRoot(asset) })
  }

  function assetToForm(asset: AssetItem): FormDropdownItem {
    return {
      id: asset.id,
      name: itemNameFor(asset),
      label: getAssetDisplayName(asset),
      preview_url: asset.preview_url,
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

  const missingItems = computed<FormDropdownItem[]>(() =>
    missingValueItem.value ? [missingValueItem.value] : []
  )

  const dropdownItems = computed<MaybePaged<FormDropdownItem>>(() => {
    if (toValue(options.isAssetMode) && assetData) {
      return [...missingItems.value, ...filteredAssetItems.value]
    }
    const targetKind = toValue(options.assetKind)
    const targetMediaType = targetKind === 'mesh' ? '3D' : targetKind
    const kindFilter = (asset: AssetItem) =>
      asset.metadata?.kind === targetKind ||
      getMediaTypeFromFilename(asset.name) === targetMediaType

    const base = baseAssets.value
    const baseItems = pagedItems(base)
      .filter(kindFilter)
      .map(assetToForm)
      .filter((item) => !missingMediaValues.value.has(item.name))
    const mapped = [...missingItems.value, ...baseItems]
    return isPaged(base) ? new WrappedList(base, () => mapped) : mapped
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
