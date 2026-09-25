import { fromPartial } from '@total-typescript/shoehorn'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { OwnershipOption } from '@/platform/assets/types/filterTypes'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWidgetSelectItems } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'
import type { UseWidgetSelectItemsOptions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'
import { useAssetsStore } from '@/stores/assetsStore'
import { pagedItems } from '@/utils/pagedList'
import type { PagedList } from '@/utils/pagedList'

vi.mock(import('@/platform/assets/composables/useAssetFilterOptions'), () => ({
  useAssetFilterOptions: () => ({
    ownershipOptions: computed(() => []),
    availableBaseModels: computed(() => []),
    availableFileFormats: computed(() => [])
  })
}))

function makeAsset(
  id: string,
  name: string,
  overrides: Partial<AssetItem> = {}
): AssetItem {
  return fromPartial({
    id,
    name,
    tags: ['input'],
    metadata: { kind: 'image' },
    ...overrides
  })
}

const makeInput = (id: string, name: string, previewUrl = ''): AssetItem =>
  makeAsset(id, name, { tags: ['input'], preview_url: previewUrl })

const makeOutput = (
  id: string,
  name: string,
  overrides: Partial<AssetItem> = {}
): AssetItem => makeAsset(id, name, { tags: ['output'], ...overrides })

const DEFAULT_INPUTS: AssetItem[] = [
  makeInput('input-0', 'img_001.png'),
  makeInput('input-1', 'photo_abc.jpg'),
  makeInput('input-2', 'hash789.png')
]

const filterSelected = ref('all')
const ownershipSelected = ref<OwnershipOption>('all')
const baseModelSelected = ref<Set<string>>(new Set())

function createDefaultOptions(
  overrides: Partial<UseWidgetSelectItemsOptions> = {}
): UseWidgetSelectItemsOptions {
  return {
    getOptionLabel: () => undefined,
    modelValue: ref<string | undefined>('img_001.png'),
    assetKind: () => 'image' as const,
    assetData: null,
    isAssetMode: () => false,
    filterSelected,
    ownershipSelected,
    baseModelSelected,
    ...overrides
  }
}

const storeAssets = {
  input: [] as AssetItem[],
  flatOutput: [] as AssetItem[]
}

const asPagedList = (items: AssetItem[]) =>
  ({
    hasMore: false,
    invalidate: async () => {},
    isLoading: false,
    items,
    loadMore: async () => false,
    loadNew: async () => {}
  }) satisfies PagedList<AssetItem>

beforeEach(() => {
  storeAssets.input = [...DEFAULT_INPUTS]
  storeAssets.flatOutput = []
  const store = useAssetsStore()
  vi.spyOn(store.inputAssets, 'items', 'get').mockImplementation(
    () => storeAssets.input
  )
  vi.spyOn(store.flatOutputAssets, 'items', 'get').mockImplementation(
    () => storeAssets.flatOutput
  )
  filterSelected.value = 'all'
  ownershipSelected.value = 'all'
  baseModelSelected.value = new Set()
})

describe('useWidgetSelectItems', () => {
  describe('base asset mapping', () => {
    it('maps store input assets to dropdown items', () => {
      const { dropdownItems } = useWidgetSelectItems(createDefaultOptions())
      expect(pagedItems(dropdownItems.value)).toHaveLength(3)
      expect(pagedItems(dropdownItems.value)[0]).toMatchObject({
        id: 'input-0',
        name: 'img_001.png',
        label: 'img_001.png'
      })
    })

    it('labels items from the asset display name, ignoring getOptionLabel', () => {
      storeAssets.input = [
        makeAsset('input-0', 'img_001.png', {
          tags: ['input'],
          display_name: 'Friendly Name'
        })
      ]
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          getOptionLabel: () => (value: string) => `Custom: ${value}`
        })
      )
      expect(pagedItems(dropdownItems.value)[0].label).toBe('Friendly Name')
    })

    it('passes the asset preview_url through unchanged', () => {
      const previewUrl = '/api/view?filename=img_001.png&type=input'
      storeAssets.input = [makeInput('input-0', 'img_001.png', previewUrl)]
      const { dropdownItems } = useWidgetSelectItems(createDefaultOptions())
      expect(pagedItems(dropdownItems.value)[0].preview_url).toBe(previewUrl)
    })

    it('annotates output assets with [output]', async () => {
      storeAssets.flatOutput = [makeOutput('out-1', 'kept.png')]
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      filterSelected.value = 'outputs'
      await nextTick()

      expect(pagedItems(dropdownItems.value)).toHaveLength(1)
      expect(pagedItems(dropdownItems.value)[0]).toMatchObject({
        name: 'kept.png [output]',
        label: 'kept.png'
      })
    })

    it('filters base assets by kind', () => {
      storeAssets.input = [
        makeInput('input-0', 'img_001.png'),
        makeAsset('mesh-0', 'model.glb', {
          tags: ['input'],
          metadata: { kind: 'mesh' }
        })
      ]
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      expect(pagedItems(dropdownItems.value)).toHaveLength(1)
      expect(pagedItems(dropdownItems.value)[0].name).toBe('img_001.png')
    })

    it('falls back to the filename media type when metadata.kind is absent', () => {
      storeAssets.input = [
        makeAsset('img-0', 'legacy.png', { tags: ['input'], metadata: {} }),
        makeAsset('mesh-0', 'legacy.glb', { tags: ['input'], metadata: {} })
      ]
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      expect(pagedItems(dropdownItems.value).map((i) => i.name)).toEqual([
        'legacy.png'
      ])
    })

    it('returns empty when the store has no assets and no modelValue', () => {
      storeAssets.input = []
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      expect(pagedItems(dropdownItems.value)).toHaveLength(0)
    })
  })

  describe('filterSelected source', () => {
    it('reads flatOutputAssets when filtering outputs', async () => {
      storeAssets.input = [makeInput('input-0', 'img_001.png')]
      storeAssets.flatOutput = [makeOutput('out-1', 'render.png')]
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      filterSelected.value = 'outputs'
      await nextTick()

      expect(pagedItems(dropdownItems.value).map((i) => i.name)).toEqual([
        'render.png [output]'
      ])
    })

    it('uses allAssets for the default filter when present', () => {
      useAssetsStore().allAssets = asPagedList([
        makeInput('a-in', 'x.png'),
        makeOutput('a-out', 'y.png')
      ])
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      expect(pagedItems(dropdownItems.value).map((i) => i.name)).toEqual([
        'x.png',
        'y.png [output]'
      ])
    })

    it('falls back to inputAssets when allAssets is undefined', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      expect(pagedItems(dropdownItems.value).map((i) => i.name)).toEqual([
        'img_001.png',
        'photo_abc.jpg',
        'hash789.png'
      ])
    })
  })

  describe('missing value fallback', () => {
    it('adds a fallback item when modelValue is absent from base assets', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref('template_image.png') })
      )
      expect(pagedItems(dropdownItems.value)[0].id).toBe(
        'missing-template_image.png'
      )
      expect(pagedItems(dropdownItems.value)[0].name).toBe('template_image.png')
    })

    it('applies getOptionLabel to the fallback label', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          modelValue: ref('template_image.png'),
          getOptionLabel: () => (value: string) => `Custom: ${value}`
        })
      )
      expect(pagedItems(dropdownItems.value)[0].label).toBe(
        'Custom: template_image.png'
      )
    })

    it('builds the fallback preview via getMediaUrl for image kind', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref('template_image.png') })
      )
      const { preview_url } = pagedItems(dropdownItems.value)[0]
      expect(preview_url).toContain('filename=template_image.png')
      expect(preview_url).toContain('type=input')
    })

    it('resolves an output-annotated fallback against the output directory', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref('gone.png [output]') })
      )
      const { preview_url } = pagedItems(dropdownItems.value)[0]
      expect(preview_url).toContain('filename=gone.png')
      expect(preview_url).toContain('type=output')
    })

    it('leaves the fallback preview empty for mesh kind', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          modelValue: ref('3d/model.glb'),
          assetKind: () => 'mesh'
        })
      )
      expect(pagedItems(dropdownItems.value)[0].preview_url).toBe('')
    })

    it('does not add a fallback when modelValue matches a base asset', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref('img_001.png') })
      )
      expect(pagedItems(dropdownItems.value)).toHaveLength(3)
      expect(
        pagedItems(dropdownItems.value).every(
          (item) => !item.id.startsWith('missing-')
        )
      ).toBe(true)
    })

    it('does not add a fallback when modelValue is undefined', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      expect(pagedItems(dropdownItems.value)).toHaveLength(3)
      expect(
        pagedItems(dropdownItems.value).every(
          (item) => !item.id.startsWith('missing-')
        )
      ).toBe(true)
    })
  })

  describe('cloud asset mode', () => {
    const createTestAsset = (id: string, name: string, previewUrl: string) =>
      fromPartial<AssetItem>({ id, name, preview_url: previewUrl, tags: [] })

    const assetDataFor = (items: AssetItem[]) => ({
      category: computed(() => 'checkpoints'),
      assets: computed(() => items),
      isLoading: computed(() => false),
      error: computed(() => null)
    })

    it('shows only available cloud assets', () => {
      const assetData = assetDataFor([
        createTestAsset('asset-1', 'model_a.safetensors', 'https://a.jpg'),
        createTestAsset('asset-2', 'model_b.safetensors', 'https://b.jpg')
      ])

      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          modelValue: ref('model_a.safetensors'),
          assetKind: () => 'model',
          isAssetMode: () => true,
          assetData
        })
      )

      expect(pagedItems(dropdownItems.value)).toHaveLength(2)
      expect(pagedItems(dropdownItems.value).map((i) => i.name)).toEqual([
        'model_a.safetensors',
        'model_b.safetensors'
      ])
    })

    it('surfaces the missing current value when no cloud assets', () => {
      const assetData = assetDataFor([])

      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          modelValue: ref('missing.safetensors'),
          assetKind: () => 'model',
          isAssetMode: () => true,
          assetData
        })
      )

      expect(pagedItems(dropdownItems.value)).toHaveLength(1)
      expect(pagedItems(dropdownItems.value)[0].name).toBe(
        'missing.safetensors'
      )
    })

    it('includes missing cloud asset in dropdownItems', () => {
      const assetData = assetDataFor([
        createTestAsset(
          'asset-1',
          'existing_model.safetensors',
          'https://x.jpg'
        )
      ])

      const { dropdownItems, selectedSet } = useWidgetSelectItems(
        createDefaultOptions({
          modelValue: ref('missing_model.safetensors'),
          assetKind: () => 'model',
          isAssetMode: () => true,
          assetData
        })
      )

      expect(pagedItems(dropdownItems.value)).toHaveLength(2)
      expect(pagedItems(dropdownItems.value)[0].name).toBe(
        'missing_model.safetensors'
      )
      expect(pagedItems(dropdownItems.value)[0].id).toBe(
        'missing-missing_model.safetensors'
      )
      expect(selectedSet.value.has('missing-missing_model.safetensors')).toBe(
        true
      )
    })
  })

  describe('selectedSet', () => {
    it('returns empty set when modelValue is undefined', () => {
      const { selectedSet } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )
      expect(selectedSet.value.size).toBe(0)
    })

    it('returns set with matching item id when modelValue matches', () => {
      const { selectedSet } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref('img_001.png') })
      )
      expect(selectedSet.value.size).toBe(1)
      expect(selectedSet.value.has('input-0')).toBe(true)
    })

    it('returns set with missing item id when modelValue matches no input', () => {
      const { selectedSet } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref('nonexistent.png') })
      )
      expect(selectedSet.value.size).toBe(1)
      expect(selectedSet.value.has('missing-nonexistent.png')).toBe(true)
    })
  })

  describe('FE-230 missing-media filtering', () => {
    it.for([
      {
        name: 'drops missing input items with warnings enabled',
        showWarning: true,
        inputs: DEFAULT_INPUTS,
        outputs: [],
        missing: 'photo_abc.jpg',
        expected: ['img_001.png', 'hash789.png']
      },
      {
        name: 'still drops missing input items with warnings disabled',
        showWarning: false,
        inputs: DEFAULT_INPUTS,
        outputs: [],
        missing: 'photo_abc.jpg',
        expected: ['img_001.png', 'hash789.png']
      },
      {
        name: 'drops output items by their annotated path',
        showWarning: true,
        inputs: [],
        outputs: [
          makeOutput('out-gone', 'gone.png'),
          makeOutput('out-kept', 'kept.png')
        ],
        missing: 'gone.png [output]',
        expected: ['kept.png [output]']
      },
      {
        name: 'does not cross-match basenames across input and output sources',
        showWarning: true,
        inputs: [makeInput('input-photo', 'photo_abc.jpg')],
        outputs: [makeOutput('out-photo', 'photo_abc.jpg')],
        missing: 'photo_abc.jpg',
        expected: ['photo_abc.jpg [output]']
      }
    ])('$name', ({ showWarning, inputs, outputs, missing, expected }) => {
      storeAssets.input = inputs
      storeAssets.flatOutput = outputs
      useMissingMediaStore().setMissingMedia([
        {
          nodeId: '1',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: missing,
          isMissing: true
        }
      ])
      useSettingStore().settingValues[
        'Comfy.Workflow.ShowMissingMediaWarning'
      ] = showWarning

      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({ modelValue: ref(undefined) })
      )

      expect(pagedItems(dropdownItems.value).map((i) => i.name)).toEqual(
        expected
      )
    })

    it('does not surface a missing-value placeholder when the modelValue is confirmed missing', async () => {
      const modelValue = ref<string | undefined>('gone.png [output]')

      const store = useMissingMediaStore()
      store.setMissingMedia([
        {
          nodeId: '7',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'gone.png [output]',
          isMissing: true
        }
      ])

      const { dropdownItems, selectedSet } = useWidgetSelectItems(
        createDefaultOptions({ modelValue })
      )
      await nextTick()

      const names = pagedItems(dropdownItems.value).map((i) => i.name)
      expect(names).not.toContain('gone.png [output]')
      expect(selectedSet.value.size).toBe(0)
    })
  })
})
