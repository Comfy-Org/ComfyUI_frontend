import { capitalize } from 'es-toolkit'
import { computed, ref, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import {
  filterItemByBaseModels,
  filterItemByOwnership
} from '@/platform/assets/utils/assetFilterUtils'
import {
  getAssetBaseModels,
  getAssetDisplayName,
  getAssetFilename
} from '@/platform/assets/utils/assetMetadataUtils'
import type {
  FilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import type { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import type { AssetKind } from '@/types/widgetTypes'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

export function getDisplayLabel(
  value: string,
  getOptionLabel?: ((value?: string | null) => string) | undefined
): string {
  if (!getOptionLabel) return value

  try {
    return getOptionLabel(value) || value
  } catch (e) {
    console.error('Failed to map value:', e)
    return value
  }
}

function assetKindToMediaType(kind: AssetKind): string {
  return kind === 'mesh' ? '3D' : kind
}

function getMediaUrl(
  filename: string,
  type: 'input' | 'output',
  assetKind: AssetKind | undefined
): string {
  if (!['image', 'video', 'audio', 'mesh'].includes(assetKind ?? '')) return ''
  const params = new URLSearchParams({ filename, type })
  appendCloudResParam(params, filename)
  return `/api/view?${params}`
}

interface UseWidgetSelectItemsOptions {
  values: MaybeRefOrGetter<unknown[] | undefined>
  getOptionLabel: MaybeRefOrGetter<
    ((value?: string | null) => string) | undefined
  >
  modelValue: Ref<string | undefined>
  assetKind: MaybeRefOrGetter<AssetKind | undefined>
  outputMediaAssets: ReturnType<typeof useMediaAssets>
  assetData: ReturnType<typeof useAssetWidgetData> | null
  isAssetMode: MaybeRefOrGetter<boolean | undefined>
}

export function useWidgetSelectItems(options: UseWidgetSelectItemsOptions) {
  const { modelValue, outputMediaAssets, assetData } = options

  const filterSelected = ref('all')
  const filterOptions = computed<FilterOption[]>(() => {
    const isAsset = toValue(options.isAssetMode)
    if (isAsset) {
      const categoryName = assetData?.category.value ?? 'All'
      return [{ name: capitalize(categoryName), value: 'all' }]
    }
    return [
      { name: 'All', value: 'all' },
      { name: 'Inputs', value: 'inputs' },
      { name: 'Outputs', value: 'outputs' }
    ]
  })

  const ownershipSelected = ref<OwnershipOption>('all')
  const showOwnershipFilter = computed(() => !!toValue(options.isAssetMode))

  const { ownershipOptions, availableBaseModels } = useAssetFilterOptions(
    () => assetData?.assets.value ?? []
  )

  const baseModelSelected = ref<Set<string>>(new Set())
  const showBaseModelFilter = computed(() => !!toValue(options.isAssetMode))
  const baseModelOptions = computed<FilterOption[]>(() => {
    if (!toValue(options.isAssetMode) || !assetData) return []
    return availableBaseModels.value
  })

  const selectedSet = ref<Set<string>>(new Set())

  const resolvedByJobId = shallowRef(new Map<string, AssetItem[]>())
  const pendingJobIds = new Set<string>()

  watch(
    () => outputMediaAssets.media.value,
    (assets, _, onCleanup) => {
      let cancelled = false
      onCleanup(() => {
        cancelled = true
      })
      pendingJobIds.clear()

      for (const asset of assets) {
        const meta = getOutputAssetMetadata(asset.user_metadata)
        if (!meta) continue

        const outputCount = meta.outputCount ?? meta.allOutputs?.length ?? 0
        if (
          outputCount <= 1 ||
          resolvedByJobId.value.has(meta.jobId) ||
          pendingJobIds.has(meta.jobId)
        )
          continue

        pendingJobIds.add(meta.jobId)
        void resolveOutputAssetItems(meta, { createdAt: asset.created_at })
          .then((resolved) => {
            if (cancelled || !resolved.length) return
            const next = new Map(resolvedByJobId.value)
            next.set(meta.jobId, resolved)
            resolvedByJobId.value = next
          })
          .catch((error) => {
            console.warn(
              'Failed to resolve multi-output job',
              meta.jobId,
              error
            )
          })
          .finally(() => {
            pendingJobIds.delete(meta.jobId)
          })
      }
    },
    { immediate: true }
  )

  const inputItems = computed<FormDropdownItem[]>(() => {
    const values = toValue(options.values) || []
    if (!Array.isArray(values)) return []

    const labelFn = toValue(options.getOptionLabel)
    const kind = toValue(options.assetKind)
    return values.map((value, index) => ({
      id: `input-${index}`,
      preview_url: getMediaUrl(String(value), 'input', kind),
      name: String(value),
      label: getDisplayLabel(String(value), labelFn)
    }))
  })

  const outputItems = computed<FormDropdownItem[]>(() => {
    const kind = toValue(options.assetKind)
    if (!['image', 'video', 'audio', 'mesh'].includes(kind ?? '')) return []

    const targetMediaType = assetKindToMediaType(kind!)
    const seen = new Set<string>()
    const items: FormDropdownItem[] = []
    const labelFn = toValue(options.getOptionLabel)

    const assets = outputMediaAssets.media.value.flatMap((asset) => {
      const meta = getOutputAssetMetadata(asset.user_metadata)
      const resolved = meta ? resolvedByJobId.value.get(meta.jobId) : undefined
      return resolved ?? [asset]
    })

    for (const asset of assets) {
      if (getMediaTypeFromFilename(asset.name) !== targetMediaType) continue
      if (seen.has(asset.id)) continue
      seen.add(asset.id)
      const annotatedPath = `${asset.name} [output]`
      items.push({
        id: `output-${annotatedPath}`,
        preview_url:
          asset.preview_url || getMediaUrl(asset.name, 'output', kind),
        name: annotatedPath,
        label: getDisplayLabel(annotatedPath, labelFn)
      })
    }

    return items
  })

  const missingValueItem = computed<FormDropdownItem | undefined>(() => {
    const currentValue = modelValue.value
    if (!currentValue) return undefined
    const labelFn = toValue(options.getOptionLabel)
    const kind = toValue(options.assetKind)

    if (toValue(options.isAssetMode) && assetData) {
      const existsInAssets = assetData.assets.value.some(
        (asset) => getAssetFilename(asset) === currentValue
      )
      if (existsInAssets) return undefined

      return {
        id: `missing-${currentValue}`,
        preview_url: '',
        name: currentValue,
        label: getDisplayLabel(currentValue, labelFn)
      }
    }

    const existsInInputs = inputItems.value.some(
      (item) => item.name === currentValue
    )
    const existsInOutputs = outputItems.value.some(
      (item) => item.name === currentValue
    )

    if (existsInInputs || existsInOutputs) return undefined

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

  const assetItems = computed<FormDropdownItem[]>(() => {
    if (!toValue(options.isAssetMode) || !assetData) return []
    return assetData.assets.value.map((asset) => ({
      id: asset.id,
      name: getAssetFilename(asset),
      label: getAssetDisplayName(asset),
      preview_url: asset.preview_url,
      is_immutable: asset.is_immutable,
      base_models: getAssetBaseModels(asset)
    }))
  })

  const ownershipFilteredAssetItems = computed<FormDropdownItem[]>(() =>
    filterItemByOwnership(assetItems.value, ownershipSelected.value)
  )

  const baseModelFilteredAssetItems = computed<FormDropdownItem[]>(() =>
    filterItemByBaseModels(
      ownershipFilteredAssetItems.value,
      baseModelSelected.value
    )
  )

  const allItems = computed<FormDropdownItem[]>(() => {
    if (toValue(options.isAssetMode) && assetData) {
      return baseModelFilteredAssetItems.value
    }
    return [
      ...(missingValueItem.value ? [missingValueItem.value] : []),
      ...inputItems.value,
      ...outputItems.value
    ]
  })

  const dropdownItems = computed<FormDropdownItem[]>(() => {
    if (toValue(options.isAssetMode)) {
      return allItems.value
    }

    switch (filterSelected.value) {
      case 'inputs':
        return inputItems.value
      case 'outputs':
        return outputItems.value
      case 'all':
      default:
        return allItems.value
    }
  })

  const displayItems = computed<FormDropdownItem[]>(() => {
    if (toValue(options.isAssetMode) && assetData && missingValueItem.value) {
      return [missingValueItem.value, ...baseModelFilteredAssetItems.value]
    }
    return dropdownItems.value
  })

  watch(
    [modelValue, displayItems],
    ([currentValue]) => {
      if (currentValue === undefined) {
        selectedSet.value.clear()
        return
      }

      const item = displayItems.value.find((item) => item.name === currentValue)
      if (!item) {
        selectedSet.value.clear()
        return
      }
      selectedSet.value.clear()
      selectedSet.value.add(item.id)
    },
    { immediate: true }
  )

  return {
    inputItems,
    outputItems,
    missingValueItem,
    allItems,
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
  }
}
