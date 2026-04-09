import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { assetService } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Mock factory using actual type
function createMockAssetItem(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'test-asset-id',
    name: 'test-image.png',
    asset_hash: 'hash123',
    size: 1024,
    mime_type: 'image/png',
    tags: ['input'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_access_time: new Date().toISOString(),
    ...overrides
  }
}

// Use vi.hoisted() to ensure mock state is initialized before mocks
const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
const mockUpdateInputs = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockGetInputName = vi.hoisted(() => vi.fn((hash: string) => hash))
const mockGetAssets = vi.hoisted(() => vi.fn(() => [] as AssetItem[]))
const mockAssetsStoreState = vi.hoisted(() => {
  const inputAssets: AssetItem[] = []
  return {
    inputAssets,
    inputLoading: false
  }
})

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockDistributionState.isCloud
  }
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: vi.fn(() => ({
    get inputAssets() {
      return mockAssetsStoreState.inputAssets
    },
    get inputLoading() {
      return mockAssetsStoreState.inputLoading
    },
    updateInputs: mockUpdateInputs,
    getInputName: mockGetInputName,
    getAssets: mockGetAssets
  }))
}))

const mockSettingStoreGet = vi.fn(() => false)
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: mockSettingStoreGet
  }))
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) =>
    key === 'widgets.selectModel' ? 'Select model' : key
  )
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    isAssetBrowserEligible: vi.fn(() => false),
    shouldUseAssetBrowser: vi.fn(() => false)
  }
}))

vi.mock('@/platform/assets/composables/useAssetBrowserDialog', () => {
  const mockAssetBrowserDialogShow = vi.fn()
  return {
    useAssetBrowserDialog: vi.fn(() => ({
      show: mockAssetBrowserDialogShow
    }))
  }
})

// Test factory functions
function createMockWidget(overrides: Partial<IBaseWidget> = {}): IBaseWidget {
  const mockCallback = vi.fn()
  const widget: IBaseWidget = {
    type: 'combo',
    options: {},
    name: 'testWidget',
    value: undefined,
    callback: mockCallback,
    y: 0,
    ...overrides
  }
  return widget
}

function createMockNode(comfyClass = 'TestNode'): LGraphNode {
  const node = new LGraphNode('TestNode')
  node.comfyClass = comfyClass

  // Spy on the addWidget method
  vi.spyOn(node, 'addWidget').mockImplementation(
    (type, name, value, callback, options = {}) => {
      const normalizedOptions =
        typeof options === 'string' ? { property: options } : options
      const widget = createMockWidget({
        type,
        name,
        value,
        options: normalizedOptions
      })
      // Store the callback function on the widget for testing
      if (typeof callback === 'function') {
        widget.callback = callback
      }
      return widget
    }
  )

  return node
}

function createMockInputSpec(overrides: Partial<InputSpec> = {}): InputSpec {
  const inputSpec: InputSpec = {
    type: 'COMBO',
    name: 'testInput',
    ...overrides
  }
  return inputSpec
}

describe('useComboWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingStoreGet.mockReturnValue(false)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(false)
    vi.mocked(assetService.shouldUseAssetBrowser).mockReturnValue(false)
    vi.mocked(useAssetBrowserDialog).mockClear()
    mockDistributionState.isCloud = false
    mockAssetsStoreState.inputAssets = []
    mockAssetsStoreState.inputLoading = false
    mockUpdateInputs.mockClear()
  })

  it('should handle undefined spec', () => {
    const constructor = useComboWidget()
    const mockWidget = createMockWidget()
    const mockNode = createMockNode()
    vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
    const inputSpec = createMockInputSpec({ name: 'inputName' })

    const widget = constructor(mockNode, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'inputName',
      undefined,
      expect.any(Function),
      expect.objectContaining({
        values: []
      })
    )
    expect(widget).toBe(mockWidget)
  })

  it('should create normal combo widget when asset API is disabled', () => {
    mockDistributionState.isCloud = true
    mockSettingStoreGet.mockReturnValue(false)
    vi.mocked(assetService.shouldUseAssetBrowser).mockReturnValue(false)

    const constructor = useComboWidget()
    const mockWidget = createMockWidget()
    const mockNode = createMockNode('CheckpointLoaderSimple')
    vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
    const inputSpec = createMockInputSpec({
      name: 'ckpt_name',
      options: ['model1.safetensors', 'model2.safetensors']
    })

    const widget = constructor(mockNode, inputSpec)
    expect(widget).toBe(mockWidget)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'ckpt_name',
      'model1.safetensors',
      expect.any(Function),
      { values: ['model1.safetensors', 'model2.safetensors'] }
    )
    expect(widget).toBe(mockWidget)
  })

  describe('cloud asset browser widget', () => {
    function createAssetWidget(
      expectedValue: string,
      inputSpecOverrides: Partial<InputSpec> = {}
    ) {
      mockDistributionState.isCloud = true
      vi.mocked(assetService.shouldUseAssetBrowser).mockReturnValue(true)

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({
        type: 'asset',
        name: 'ckpt_name',
        value: expectedValue
      })
      const mockNode = createMockNode('CheckpointLoaderSimple')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'ckpt_name',
        ...inputSpecOverrides
      })

      const widget = constructor(mockNode, inputSpec)

      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'asset',
        'ckpt_name',
        expectedValue,
        expect.any(Function),
        expect.any(Object)
      )
      return { widget, mockWidget, mockNode }
    }

    it('should create asset browser widget when API enabled', () => {
      mockGetAssets.mockReturnValue([
        createMockAssetItem({ name: 'cloud_model.safetensors' })
      ])

      const { widget, mockWidget } = createAssetWidget(
        'cloud_model.safetensors',
        { options: ['model1.safetensors', 'model2.safetensors'] }
      )

      expect(
        vi.mocked(assetService.shouldUseAssetBrowser)
      ).toHaveBeenCalledWith('CheckpointLoaderSimple', 'ckpt_name')
      expect(widget).toBe(mockWidget)
    })

    it('should use first cloud asset as default instead of server combo options', () => {
      mockGetAssets.mockReturnValue([
        createMockAssetItem({ name: 'cloud_model.safetensors' })
      ])

      const { widget, mockWidget } = createAssetWidget(
        'cloud_model.safetensors',
        { options: ['local_only_model.safetensors'] }
      )

      expect(widget).toBe(mockWidget)
    })

    it('should fallback to assets[0] when inputSpec.default not in cloud assets', () => {
      mockGetAssets.mockReturnValue([
        createMockAssetItem({ name: 'cloud_model.safetensors' })
      ])

      const { widget, mockWidget } = createAssetWidget(
        'cloud_model.safetensors',
        { default: 'not_in_cloud.safetensors' }
      )

      expect(widget).toBe(mockWidget)
    })

    it('should prefer inputSpec.default when it exists in cloud assets', () => {
      mockGetAssets.mockReturnValue([
        createMockAssetItem({ name: 'other_model.safetensors' }),
        createMockAssetItem({ name: 'fallback.safetensors' })
      ])

      const { widget, mockWidget } = createAssetWidget(
        'fallback.safetensors',
        // Note: no options array provided
        { default: 'fallback.safetensors' }
      )

      expect(widget).toBe(mockWidget)
    })

    it('should create asset browser widget when default value provided without options', () => {
      mockGetAssets.mockReturnValue([])

      const { widget, mockWidget } = createAssetWidget(
        'Select model',
        // Note: no options array provided
        { default: 'fallback.safetensors' }
      )

      expect(widget).toBe(mockWidget)
    })

    it('should fallback to placeholder when cloud assets not loaded', () => {
      mockGetAssets.mockReturnValue([])

      const { widget, mockWidget } = createAssetWidget('Select model', {
        options: ['local_model.safetensors']
      })

      expect(widget).toBe(mockWidget)
    })
  })

  it('should show Select model when asset widget has undefined current value', () => {
    mockDistributionState.isCloud = true
    vi.mocked(assetService.shouldUseAssetBrowser).mockReturnValue(true)

    const constructor = useComboWidget()
    const mockWidget = createMockWidget({
      type: 'asset',
      name: 'ckpt_name',
      value: 'Select model'
    })
    const mockNode = createMockNode('CheckpointLoaderSimple')
    vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
    const inputSpec = createMockInputSpec({
      name: 'ckpt_name'
      // Note: no default, no options, not remote - getDefaultValue returns undefined
    })

    const widget = constructor(mockNode, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'asset',
      'ckpt_name',
      'Select model', // Should fallback to this instead of undefined
      expect.any(Function),
      expect.any(Object)
    )
    expect(widget).toBe(mockWidget)
  })

  describe('cloud input asset mapping', () => {
    const HASH_FILENAME =
      '72e786ff2a44d682c4294db0b7098e569832bc394efc6dad644e6ec85a78efb7.png'
    const HASH_FILENAME_2 =
      'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456.jpg'

    it.each([
      { nodeClass: 'LoadImage', inputName: 'image' },
      { nodeClass: 'LoadVideo', inputName: 'video' },
      { nodeClass: 'LoadAudio', inputName: 'audio' }
    ])(
      'should create combo widget with getOptionLabel for $nodeClass in cloud',
      ({ nodeClass, inputName }) => {
        mockDistributionState.isCloud = true

        const constructor = useComboWidget()
        const mockWidget = createMockWidget({
          type: 'combo',
          name: inputName,
          value: HASH_FILENAME
        })
        const mockNode = createMockNode(nodeClass)
        vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
        const inputSpec = createMockInputSpec({
          name: inputName,
          options: [HASH_FILENAME, HASH_FILENAME_2]
        })

        const widget = constructor(mockNode, inputSpec)

        expect(mockNode.addWidget).toHaveBeenCalledWith(
          'combo',
          inputName,
          HASH_FILENAME,
          expect.any(Function),
          expect.objectContaining({
            values: [], // Empty initially, populated via dynamic getter
            getOptionLabel: expect.any(Function)
          })
        )
        expect(widget).toBe(mockWidget)
      }
    )

    it('should keep the original options object for cloud input mappings', () => {
      mockDistributionState.isCloud = true

      const constructor = useComboWidget()
      const mockNode = createMockNode('LoadImage')
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [HASH_FILENAME]
      })

      const widget = constructor(mockNode, inputSpec)
      const addWidgetCall = vi.mocked(mockNode.addWidget).mock.calls[0]
      const options = addWidgetCall[4]

      expect(widget.options).toBe(options)
    })

    it("should format option labels using store's getInputName function", () => {
      mockDistributionState.isCloud = true
      mockGetInputName.mockReturnValue('Beautiful Sunset.png')

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({
        type: 'combo',
        name: 'image',
        value: HASH_FILENAME
      })
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [HASH_FILENAME]
      })

      constructor(mockNode, inputSpec)

      // Extract the injected getOptionLabel function with type narrowing
      const addWidgetCall = vi.mocked(mockNode.addWidget).mock.calls[0]
      const options = addWidgetCall[4]

      if (typeof options !== 'object' || !options) {
        throw new Error('Expected options to be an object')
      }

      if (!('getOptionLabel' in options)) {
        throw new Error('Expected options to have getOptionLabel property')
      }

      if (typeof options.getOptionLabel !== 'function') {
        throw new Error('Expected getOptionLabel to be a function')
      }

      // Test that the injected function calls getInputName
      const result = options.getOptionLabel(HASH_FILENAME)
      expect(mockGetInputName).toHaveBeenCalledWith(HASH_FILENAME)
      expect(result).toBe('Beautiful Sunset.png')
    })

    it('should create normal combo widget for non-input nodes in cloud', () => {
      mockDistributionState.isCloud = true

      const constructor = useComboWidget()
      const mockWidget = createMockWidget()
      const mockNode = createMockNode('SomeOtherNode')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'option',
        options: [HASH_FILENAME, HASH_FILENAME_2]
      })

      const widget = constructor(mockNode, inputSpec)

      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'combo',
        'option',
        HASH_FILENAME,
        expect.any(Function),
        { values: [HASH_FILENAME, HASH_FILENAME_2] }
      )
      expect(widget).toBe(mockWidget)
    })

    it('should create normal combo widget for LoadImage in OSS', () => {
      mockDistributionState.isCloud = false

      const constructor = useComboWidget()
      const mockWidget = createMockWidget()
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [HASH_FILENAME, HASH_FILENAME_2]
      })

      const widget = constructor(mockNode, inputSpec)

      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'combo',
        'image',
        HASH_FILENAME,
        expect.any(Function),
        {
          values: [HASH_FILENAME, HASH_FILENAME_2]
        }
      )
      expect(widget).toBe(mockWidget)
    })

    it('should trigger lazy load for cloud input nodes', () => {
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = []
      mockAssetsStoreState.inputLoading = false

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({ type: 'combo' })
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [HASH_FILENAME]
      })

      constructor(mockNode, inputSpec)

      expect(mockUpdateInputs).toHaveBeenCalledTimes(1)
    })

    it('should not trigger lazy load if assets already loading', () => {
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = []
      mockAssetsStoreState.inputLoading = true

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({ type: 'combo' })
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [HASH_FILENAME]
      })

      constructor(mockNode, inputSpec)

      expect(mockUpdateInputs).not.toHaveBeenCalled()
    })

    it('should not trigger lazy load if assets already loaded', () => {
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = [
        createMockAssetItem({
          id: 'asset-123',
          name: 'image1.png',
          asset_hash: HASH_FILENAME
        })
      ]
      mockAssetsStoreState.inputLoading = false

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({ type: 'combo' })
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [HASH_FILENAME]
      })

      constructor(mockNode, inputSpec)

      expect(mockUpdateInputs).not.toHaveBeenCalled()
    })
  })
})
