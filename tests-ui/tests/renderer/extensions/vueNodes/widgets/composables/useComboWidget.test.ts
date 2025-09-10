import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { assetService } from '@/services/assetService'

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn()
}))

const mockSettingStoreGet = vi.fn(() => false) // Default: asset API disabled
vi.mock('@/stores/settingStore', () => ({
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
    isAssetBrowserEligible: vi.fn(() => false) // Default: not eligible
  }
}))

describe('useComboWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to defaults
    mockSettingStoreGet.mockReturnValue(false)
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(false)
  })

  it('should handle undefined spec', () => {
    const constructor = useComboWidget()
    const mockNode = {
      addWidget: vi.fn().mockReturnValue({ type: 'combo', options: {} } as any)
    }

    const inputSpec: InputSpec = {
      type: 'COMBO',
      name: 'inputName'
    }

    const widget = constructor(mockNode as any, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'inputName',
      undefined, // default value
      expect.any(Function), // callback
      expect.objectContaining({
        values: []
      })
    )
    expect(widget).toEqual({ type: 'combo', options: {} })
  })

  it('should create normal combo widget when asset API is disabled', () => {
    mockSettingStoreGet.mockReturnValue(false) // Asset API disabled
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true) // Widget is eligible

    const constructor = useComboWidget()
    const mockNode = {
      addWidget: vi.fn().mockReturnValue({ type: 'combo', options: {} })
    }

    const inputSpec = {
      type: 'COMBO' as const,
      name: 'ckpt_name',
      options: ['model1.safetensors', 'model2.safetensors']
    }

    const widget = constructor(mockNode as any, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'ckpt_name',
      'model1.safetensors',
      expect.any(Function),
      { values: ['model1.safetensors', 'model2.safetensors'] }
    )
    expect(mockSettingStoreGet).toHaveBeenCalledWith('Comfy.Assets.UseAssetAPI')
    expect(widget).toEqual({ type: 'combo', options: {} })
  })

  it('should create normal combo widget when widget is not eligible for asset browser', () => {
    mockSettingStoreGet.mockReturnValue(true) // Asset API enabled
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(false) // Widget not eligible

    const constructor = useComboWidget()
    const mockNode = {
      addWidget: vi.fn().mockReturnValue({ type: 'combo', options: {} })
    }

    const inputSpec = {
      type: 'COMBO' as const,
      name: 'not_eligible_widget',
      options: ['option1', 'option2']
    }

    const widget = constructor(mockNode as any, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'not_eligible_widget',
      'option1',
      expect.any(Function),
      { values: ['option1', 'option2'] }
    )
    expect(vi.mocked(assetService.isAssetBrowserEligible)).toHaveBeenCalledWith(
      'not_eligible_widget'
    )
    expect(widget).toEqual({ type: 'combo', options: {} })
  })

  it('should create asset browser combo widget when API enabled and widget eligible', () => {
    mockSettingStoreGet.mockReturnValue(true) // Asset API enabled
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true) // Widget eligible

    const constructor = useComboWidget()
    const mockWidget = {
      type: 'combo',
      options: {},
      name: 'ckpt_name',
      value: 'model1.safetensors'
    }
    const mockNode = {
      addWidget: vi.fn().mockReturnValue(mockWidget)
    }

    const inputSpec = {
      type: 'COMBO' as const,
      name: 'ckpt_name',
      options: ['model1.safetensors', 'model2.safetensors']
    }

    const widget = constructor(mockNode as any, inputSpec)

    // Should create combo widget with asset browser configuration, not normal path
    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'ckpt_name',
      'model1.safetensors',
      expect.any(Function),
      { values: ['Select model'] } // Key difference - asset browser path
    )

    expect(mockSettingStoreGet).toHaveBeenCalledWith('Comfy.Assets.UseAssetAPI')
    expect(vi.mocked(assetService.isAssetBrowserEligible)).toHaveBeenCalledWith(
      'ckpt_name'
    )
    expect(widget).toBe(mockWidget)
  })

  it('should use asset browser values even when inputSpec has a default value but no options', () => {
    mockSettingStoreGet.mockReturnValue(true) // Asset API enabled
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true) // Widget eligible

    const constructor = useComboWidget()
    const mockWidget = {
      type: 'combo',
      options: {},
      name: 'ckpt_name',
      value: 'fallback.safetensors'
    }
    const mockNode = {
      addWidget: vi.fn().mockReturnValue(mockWidget)
    }

    const inputSpec = {
      type: 'COMBO' as const,
      name: 'ckpt_name',
      default: 'fallback.safetensors'
      // Note: no options array provided
    }

    const widget = constructor(mockNode as any, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'ckpt_name',
      'fallback.safetensors',
      expect.any(Function),
      { values: ['Select model'] } // Should still use asset browser path
    )

    expect(mockSettingStoreGet).toHaveBeenCalledWith('Comfy.Assets.UseAssetAPI')
    expect(vi.mocked(assetService.isAssetBrowserEligible)).toHaveBeenCalledWith(
      'ckpt_name'
    )
    expect(widget).toBe(mockWidget)
  })
})
