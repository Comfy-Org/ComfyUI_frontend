import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { assetService } from '@/platform/assets/services/assetService'
import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Use vi.hoisted() to ensure mock state is initialized before mocks
const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
const mockUpdateInputs = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockGetInputName = vi.hoisted(() => vi.fn((hash: string) => hash))
const mockAssetsStoreState = vi.hoisted(() => ({
  inputAssets: [] as any[],
  inputLoading: false
}))

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
    getInputName: mockGetInputName
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
    isAssetBrowserEligible: vi.fn(() => false)
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
  return {
    type: 'combo',
    options: {},
    name: 'testWidget',
    value: undefined,
    callback: mockCallback,
    y: 0,
    ...overrides
  } as IBaseWidget
}

function createMockNode(comfyClass = 'TestNode'): LGraphNode {
  const node = new LGraphNode('TestNode')
  node.comfyClass = comfyClass

  // Spy on the addWidget method
  vi.spyOn(node, 'addWidget').mockImplementation(
    (type, name, value, callback) => {
      const widget = createMockWidget({ type, name, value })
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
  return {
    type: 'COMBO',
    name: 'testInput',
    ...overrides
  } as InputSpec
}

describe('useComboWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingStoreGet.mockReturnValue(false)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(false)
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
    mockSettingStoreGet.mockReturnValue(false) // Asset API disabled
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true) // Widget is eligible

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
    expect(mockSettingStoreGet).toHaveBeenCalledWith('Comfy.Assets.UseAssetAPI')
    expect(widget).toBe(mockWidget)
  })

  it('should create asset browser widget when API enabled', () => {
    mockSettingStoreGet.mockReturnValue(true)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true)

    const constructor = useComboWidget()
    const mockWidget = createMockWidget({
      type: 'asset',
      name: 'ckpt_name',
      value: 'model1.safetensors'
    })
    const mockNode = createMockNode('CheckpointLoaderSimple')
    vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
    const inputSpec = createMockInputSpec({
      name: 'ckpt_name',
      options: ['model1.safetensors', 'model2.safetensors']
    })

    const widget = constructor(mockNode, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'asset',
      'ckpt_name',
      'model1.safetensors',
      expect.any(Function)
    )
    expect(mockSettingStoreGet).toHaveBeenCalledWith('Comfy.Assets.UseAssetAPI')
    expect(vi.mocked(assetService.isAssetBrowserEligible)).toHaveBeenCalledWith(
      'CheckpointLoaderSimple',
      'ckpt_name'
    )
    expect(widget).toBe(mockWidget)
  })

  it('should create asset browser widget with options when API enabled', () => {
    mockSettingStoreGet.mockReturnValue(true)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true)

    const constructor = useComboWidget()
    const mockWidget = createMockWidget({
      type: 'asset',
      name: 'ckpt_name',
      value: 'model1.safetensors'
    })
    const mockNode = createMockNode('CheckpointLoaderSimple')
    vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
    const inputSpec = createMockInputSpec({
      name: 'ckpt_name',
      options: ['model1.safetensors', 'model2.safetensors']
    })

    const widget = constructor(mockNode, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'asset',
      'ckpt_name',
      'model1.safetensors',
      expect.any(Function)
    )
    expect(mockSettingStoreGet).toHaveBeenCalledWith('Comfy.Assets.UseAssetAPI')
    expect(widget).toBe(mockWidget)
  })

  it('should use asset browser widget even when inputSpec has a default value but no options', () => {
    mockSettingStoreGet.mockReturnValue(true)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true)

    const constructor = useComboWidget()
    const mockWidget = createMockWidget({
      type: 'asset',
      name: 'ckpt_name',
      value: 'fallback.safetensors'
    })
    const mockNode = createMockNode('CheckpointLoaderSimple')
    vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
    const inputSpec = createMockInputSpec({
      name: 'ckpt_name',
      default: 'fallback.safetensors'
      // Note: no options array provided
    })

    const widget = constructor(mockNode, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'asset',
      'ckpt_name',
      'fallback.safetensors',
      expect.any(Function)
    )
    expect(mockSettingStoreGet).toHaveBeenCalledWith('Comfy.Assets.UseAssetAPI')
    expect(widget).toBe(mockWidget)
  })

  it('should show Select model when asset widget has undefined current value', () => {
    mockSettingStoreGet.mockReturnValue(true)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true)

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
      expect.any(Function)
    )
    expect(mockSettingStoreGet).toHaveBeenCalledWith('Comfy.Assets.UseAssetAPI')
    expect(widget).toBe(mockWidget)
  })

  describe('mapped_combo widget creation', () => {
    const HASH_FILENAME =
      '72e786ff2a44d682c4294db0b7098e569832bc394efc6dad644e6ec85a78efb7.png'
    const HASH_FILENAME_2 =
      'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456.jpg'

    it('should create mapped_combo widget in cloud when options contain SHA256 hash filenames', () => {
      mockDistributionState.isCloud = true

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({
        type: 'mapped_combo',
        name: 'image',
        value: HASH_FILENAME
      })
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [HASH_FILENAME, HASH_FILENAME_2]
      })

      const widget = constructor(mockNode, inputSpec)

      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'mapped_combo',
        'image',
        HASH_FILENAME,
        expect.any(Function),
        expect.objectContaining({
          values: [HASH_FILENAME, HASH_FILENAME_2],
          mapValue: expect.any(Function)
        })
      )
      expect(widget).toBe(mockWidget)
    })

    it('should inject mapValue function that calls getInputName', () => {
      mockDistributionState.isCloud = true
      mockGetInputName.mockReturnValue('Beautiful Sunset.png')

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({
        type: 'mapped_combo',
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

      // Extract the injected mapValue function
      const addWidgetCall = vi.mocked(mockNode.addWidget).mock.calls[0]
      const options = addWidgetCall[4] as any
      const mapValueFn = options.mapValue

      // Test that the injected function calls getInputName
      const result = mapValueFn(HASH_FILENAME)
      expect(mockGetInputName).toHaveBeenCalledWith(HASH_FILENAME)
      expect(result).toBe('Beautiful Sunset.png')
    })

    it('should create normal combo widget in cloud when options do not contain hash filenames', () => {
      mockDistributionState.isCloud = true

      const constructor = useComboWidget()
      const mockWidget = createMockWidget()
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: ['image1.png', 'image2.jpg']
      })

      const widget = constructor(mockNode, inputSpec)

      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'combo',
        'image',
        'image1.png',
        expect.any(Function),
        { values: ['image1.png', 'image2.jpg'] }
      )
      expect(widget).toBe(mockWidget)
    })

    it('should create normal combo widget in OSS even with hash filename patterns', () => {
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

    it('should trigger lazy load when first hash filename widget created', () => {
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = []
      mockAssetsStoreState.inputLoading = false

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({ type: 'mapped_combo' })
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
      const mockWidget = createMockWidget({ type: 'mapped_combo' })
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
        { id: 'asset-123', name: 'image1.png', asset_hash: HASH_FILENAME }
      ] as any
      mockAssetsStoreState.inputLoading = false

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({ type: 'mapped_combo' })
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
