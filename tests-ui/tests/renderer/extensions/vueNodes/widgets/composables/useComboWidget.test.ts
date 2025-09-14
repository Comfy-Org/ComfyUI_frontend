import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { assetService } from '@/services/assetService'

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn()
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

vi.mock('@/services/assetService', () => ({
  assetService: {
    isAssetBrowserEligible: vi.fn(() => false)
  }
}))

// Test factory functions
function createMockWidget(overrides: Partial<IBaseWidget> = {}): IBaseWidget {
  return {
    type: 'combo',
    options: {},
    name: 'testWidget',
    value: undefined,
    ...overrides
  } as IBaseWidget
}

function createMockNode(comfyClass = 'TestNode'): LGraphNode {
  const node = new LGraphNode('TestNode')
  node.comfyClass = comfyClass

  // Spy on the addWidget method
  vi.spyOn(node, 'addWidget').mockReturnValue(createMockWidget())

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
    // Reset to defaults
    mockSettingStoreGet.mockReturnValue(false)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(false)
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

  it('should create normal combo widget when widget is not eligible for asset browser', () => {
    mockSettingStoreGet.mockReturnValue(true)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(false)

    const constructor = useComboWidget()
    const mockWidget = createMockWidget()
    const mockNode = createMockNode()
    vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
    const inputSpec = createMockInputSpec({
      name: 'not_eligible_widget',
      options: ['option1', 'option2']
    })

    const widget = constructor(mockNode, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'not_eligible_widget',
      'option1',
      expect.any(Function),
      { values: ['option1', 'option2'] }
    )
    expect(vi.mocked(assetService.isAssetBrowserEligible)).toHaveBeenCalledWith(
      'not_eligible_widget',
      'TestNode'
    )
    expect(widget).toBe(mockWidget)
  })

  it('should create asset browser widget when API enabled and widget eligible', () => {
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
      'ckpt_name',
      'CheckpointLoaderSimple'
    )
    expect(widget).toBe(mockWidget)
  })

  it('should create asset browser widget with options when API enabled and widget eligible', () => {
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
      'ckpt_name',
      'CheckpointLoaderSimple'
    )
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
    expect(vi.mocked(assetService.isAssetBrowserEligible)).toHaveBeenCalledWith(
      'ckpt_name',
      'CheckpointLoaderSimple'
    )
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
    expect(vi.mocked(assetService.isAssetBrowserEligible)).toHaveBeenCalledWith(
      'ckpt_name',
      'CheckpointLoaderSimple'
    )
    expect(widget).toBe(mockWidget)
  })
})
