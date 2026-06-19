import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { assetService } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { addValueControlWidgets } from '@/scripts/widgets'

function createMockAssetItem(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'test-asset-id',
    name: 'test-image.png',
    hash: 'hash123',
    size: 1024,
    mime_type: 'image/png',
    tags: ['input'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_access_time: new Date().toISOString(),
    ...overrides
  }
}

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
    mockGetInputName.mockImplementation((hash: string) => hash)
    mockGetAssets.mockImplementation(() => [])
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(false)
    vi.mocked(assetService.shouldUseAssetBrowser).mockReturnValue(false)
    mockDistributionState.isCloud = false
    mockAssetsStoreState.inputAssets = []
    mockAssetsStoreState.inputLoading = false
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
    // "Select model" is the fallback from t('widgets.selectModel')
    // in createAssetWidget when defaultValue is undefined.
    const PLACEHOLDER = 'Select model'

    function setupCloudAssetWidget(
      inputSpecOverrides: Partial<InputSpec> = {}
    ) {
      mockDistributionState.isCloud = true
      vi.mocked(assetService.shouldUseAssetBrowser).mockReturnValue(true)

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({
        type: 'asset',
        name: 'ckpt_name',
        value: ''
      })
      const mockNode = createMockNode('CheckpointLoaderSimple')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'ckpt_name',
        ...inputSpecOverrides
      })

      constructor(mockNode, inputSpec)
      return { mockNode }
    }

    function getWidgetDefault(mockNode: ReturnType<typeof createMockNode>) {
      return vi.mocked(mockNode.addWidget).mock.calls[0]?.[2]
    }

    it('should create asset browser widget when API enabled', () => {
      mockGetAssets.mockReturnValue([
        createMockAssetItem({ name: 'cloud_model.safetensors' })
      ])

      const { mockNode } = setupCloudAssetWidget({
        options: ['model1.safetensors', 'model2.safetensors']
      })

      expect(
        vi.mocked(assetService.shouldUseAssetBrowser)
      ).toHaveBeenCalledWith('CheckpointLoaderSimple', 'ckpt_name')
      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'asset',
        'ckpt_name',
        expect.anything(),
        expect.any(Function),
        expect.any(Object)
      )
    })

    it('should use first cloud asset as default instead of server combo options', () => {
      mockGetAssets.mockReturnValue([
        createMockAssetItem({ name: 'cloud_model.safetensors' })
      ])

      const { mockNode } = setupCloudAssetWidget({
        options: ['local_only_model.safetensors']
      })

      expect(getWidgetDefault(mockNode)).toBe('cloud_model.safetensors')
    })

    it('should fallback to assets[0] when inputSpec.default not in cloud assets', () => {
      mockGetAssets.mockReturnValue([
        createMockAssetItem({ name: 'cloud_model.safetensors' })
      ])

      const { mockNode } = setupCloudAssetWidget({
        default: 'not_in_cloud.safetensors'
      })

      expect(getWidgetDefault(mockNode)).toBe('cloud_model.safetensors')
    })

    it('should prefer inputSpec.default when it exists in cloud assets', () => {
      mockGetAssets.mockReturnValue([
        createMockAssetItem({ name: 'other_model.safetensors' }),
        createMockAssetItem({ name: 'fallback.safetensors' })
      ])

      const { mockNode } = setupCloudAssetWidget({
        // Note: no options array provided
        default: 'fallback.safetensors'
      })

      expect(getWidgetDefault(mockNode)).toBe('fallback.safetensors')
    })

    it('should create asset browser widget when default value provided without options', () => {
      mockGetAssets.mockReturnValue([])

      const { mockNode } = setupCloudAssetWidget({
        // Note: no options array provided
        default: 'fallback.safetensors'
      })

      expect(getWidgetDefault(mockNode)).toBe(PLACEHOLDER)
    })

    it('should fallback to placeholder when cloud assets not loaded', () => {
      mockGetAssets.mockReturnValue([])

      const { mockNode } = setupCloudAssetWidget({
        options: ['local_model.safetensors']
      })

      expect(getWidgetDefault(mockNode)).toBe(PLACEHOLDER)
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
    const cloudInputScenarios = [
      {
        nodeClass: 'LoadImage',
        inputName: 'image',
        assetName: 'cloud-image.png',
        assetHash: 'cloud-image-hash.png',
        serverOption: 'server-only-image.png'
      },
      {
        nodeClass: 'LoadVideo',
        inputName: 'file',
        assetName: 'cloud-video.mp4',
        assetHash: 'cloud-video-hash.mp4',
        serverOption: 'server-only-video.mp4'
      },
      {
        nodeClass: 'LoadAudio',
        inputName: 'audio',
        assetName: 'cloud-audio.wav',
        assetHash: 'cloud-audio-hash.wav',
        serverOption: 'server-only-audio.wav'
      }
    ] as const

    function setupCloudInputMappingWidget(
      scenario: (typeof cloudInputScenarios)[number],
      inputSpecOverrides: Partial<InputSpec> = {},
      inputAssets: AssetItem[] = []
    ) {
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = inputAssets

      const constructor = useComboWidget()
      const mockNode = createMockNode(scenario.nodeClass)
      const inputSpec = createMockInputSpec({
        name: scenario.inputName,
        ...inputSpecOverrides
      })

      const widget = constructor(mockNode, inputSpec)
      return { mockNode, widget }
    }

    function getInputWidgetDefault(
      mockNode: ReturnType<typeof createMockNode>
    ) {
      return vi.mocked(mockNode.addWidget).mock.calls[0]?.[2]
    }

    function getInputWidgetOptions(
      mockNode: ReturnType<typeof createMockNode>
    ) {
      const options = vi.mocked(mockNode.addWidget).mock.calls[0]?.[4]

      if (typeof options !== 'object' || !options) {
        throw new Error('Expected options to be an object')
      }

      return options
    }

    function getInputWidgetValues(mockNode: ReturnType<typeof createMockNode>) {
      const options = getInputWidgetOptions(mockNode)

      if (!('values' in options)) {
        throw new Error('Expected options to have values property')
      }

      return options.values
    }

    it.for(cloudInputScenarios)(
      'should use an empty default for $nodeClass when only server combo options exist',
      (scenario) => {
        const { mockNode, widget } = setupCloudInputMappingWidget(scenario, {
          options: [scenario.serverOption]
        })

        expect(getInputWidgetDefault(mockNode)).toBe('')
        expect(widget.value).toBe('')
      }
    )

    it.for(cloudInputScenarios)(
      'should use first matching cloud input asset for $nodeClass instead of server combo options',
      (scenario) => {
        const { mockNode, widget } = setupCloudInputMappingWidget(
          scenario,
          { options: [scenario.serverOption] },
          [
            createMockAssetItem({
              name: scenario.assetName,
              hash: scenario.assetHash
            })
          ]
        )

        expect(getInputWidgetDefault(mockNode)).toBe(scenario.assetHash)
        expect(widget.value).toBe(scenario.assetHash)
      }
    )

    it.for(cloudInputScenarios)(
      'should use an empty default for $nodeClass when inputSpec.default is not in cloud input assets',
      (scenario) => {
        const { mockNode, widget } = setupCloudInputMappingWidget(scenario, {
          default: scenario.serverOption
        })

        expect(getInputWidgetDefault(mockNode)).toBe('')
        expect(widget.value).toBe('')
      }
    )

    it.for(cloudInputScenarios)(
      'should fallback to first matching cloud input asset for $nodeClass when inputSpec.default is not in assets',
      (scenario) => {
        const { mockNode, widget } = setupCloudInputMappingWidget(
          scenario,
          { default: scenario.serverOption },
          [
            createMockAssetItem({
              name: scenario.assetName,
              hash: scenario.assetHash
            })
          ]
        )

        expect(getInputWidgetDefault(mockNode)).toBe(scenario.assetHash)
        expect(widget.value).toBe(scenario.assetHash)
      }
    )

    it.for(cloudInputScenarios)(
      'should prefer inputSpec.default for $nodeClass when it matches a cloud input asset hash',
      (scenario) => {
        const fallbackHash = `fallback-${scenario.assetHash}`
        const { mockNode, widget } = setupCloudInputMappingWidget(
          scenario,
          { default: scenario.assetHash },
          [
            createMockAssetItem({
              name: `fallback-${scenario.assetName}`,
              hash: fallbackHash
            }),
            createMockAssetItem({
              name: scenario.assetName,
              hash: scenario.assetHash
            })
          ]
        )

        expect(getInputWidgetDefault(mockNode)).toBe(scenario.assetHash)
        expect(widget.value).toBe(scenario.assetHash)
      }
    )

    it.for(cloudInputScenarios)(
      'should prefer inputSpec.default for $nodeClass when it matches a cloud input asset name',
      (scenario) => {
        const fallbackHash = `fallback-${scenario.assetHash}`
        const { mockNode, widget } = setupCloudInputMappingWidget(
          scenario,
          { default: scenario.assetName },
          [
            createMockAssetItem({
              name: `fallback-${scenario.assetName}`,
              hash: fallbackHash
            }),
            createMockAssetItem({
              name: scenario.assetName,
              hash: scenario.assetHash
            })
          ]
        )

        expect(getInputWidgetDefault(mockNode)).toBe(scenario.assetHash)
        expect(widget.value).toBe(scenario.assetHash)
      }
    )

    it.for(cloudInputScenarios)(
      'should prefer a hash match over an earlier name match for $nodeClass',
      (scenario) => {
        const nameMatchHash = `name-match-${scenario.assetHash}`
        const { mockNode, widget } = setupCloudInputMappingWidget(
          scenario,
          { default: scenario.assetHash },
          [
            createMockAssetItem({
              name: scenario.assetHash,
              hash: nameMatchHash
            }),
            createMockAssetItem({
              name: scenario.assetName,
              hash: scenario.assetHash
            })
          ]
        )

        expect(getInputWidgetDefault(mockNode)).toBe(scenario.assetHash)
        expect(widget.value).toBe(scenario.assetHash)
      }
    )

    it.for(cloudInputScenarios)(
      'should create combo widget options for $nodeClass using cloud input values',
      (scenario) => {
        const { mockNode, widget } = setupCloudInputMappingWidget(scenario, {
          options: [scenario.serverOption]
        })

        expect(mockNode.addWidget).toHaveBeenCalledWith(
          'combo',
          scenario.inputName,
          '',
          expect.any(Function),
          expect.objectContaining({
            values: [],
            getOptionLabel: expect.any(Function)
          })
        )
        expect(widget.type).toBe('combo')
      }
    )

    it.for(cloudInputScenarios)(
      'should expose only matching cloud input asset values for $nodeClass',
      (scenario) => {
        const { mockNode } = setupCloudInputMappingWidget(
          scenario,
          { options: [scenario.serverOption] },
          [
            createMockAssetItem({
              name: 'wrong-kind.txt',
              hash: 'wrong-kind.txt'
            }),
            createMockAssetItem({
              name: scenario.assetName,
              hash: scenario.assetHash
            }),
            createMockAssetItem({
              name: `second-${scenario.assetName}`,
              hash: `second-${scenario.assetHash}`
            })
          ]
        )

        const values = getInputWidgetValues(mockNode)
        expect(values).toEqual([
          scenario.assetHash,
          `second-${scenario.assetHash}`
        ])
        expect(values).toContain(getInputWidgetDefault(mockNode))
      }
    )

    it.for(cloudInputScenarios)(
      'should ignore cloud input assets without hashes for $nodeClass',
      (scenario) => {
        const { mockNode, widget } = setupCloudInputMappingWidget(
          scenario,
          { default: scenario.assetName },
          [
            createMockAssetItem({
              name: scenario.assetName,
              hash: ''
            })
          ]
        )

        expect(getInputWidgetDefault(mockNode)).toBe('')
        expect(widget.value).toBe('')
        expect(getInputWidgetValues(mockNode)).toEqual([])
      }
    )

    it('should keep the original options object for cloud input mappings', () => {
      const scenario = cloudInputScenarios[0]

      const { mockNode, widget } = setupCloudInputMappingWidget(scenario, {
        options: [scenario.serverOption]
      })
      const addWidgetCall = vi.mocked(mockNode.addWidget).mock.calls[0]
      const options = addWidgetCall[4]

      expect(widget.options).toBe(options)
    })

    it("should format option labels using store's getInputName function", () => {
      const scenario = cloudInputScenarios[0]
      mockGetInputName.mockReturnValue('Beautiful Sunset.png')

      const { mockNode } = setupCloudInputMappingWidget(
        scenario,
        { options: [scenario.serverOption] },
        [
          createMockAssetItem({
            name: scenario.assetName,
            hash: scenario.assetHash
          })
        ]
      )
      const options = getInputWidgetOptions(mockNode)

      if (!('getOptionLabel' in options)) {
        throw new Error('Expected options to have getOptionLabel property')
      }

      if (typeof options.getOptionLabel !== 'function') {
        throw new Error('Expected getOptionLabel to be a function')
      }

      const result = options.getOptionLabel(scenario.assetHash)
      expect(mockGetInputName).toHaveBeenCalledWith(scenario.assetHash)
      expect(result).toBe('Beautiful Sunset.png')
    })

    it('should add control widgets for cloud input mappings when requested', () => {
      const scenario = cloudInputScenarios[0]

      const { mockNode, widget } = setupCloudInputMappingWidget(
        scenario,
        { control_after_generate: true },
        [
          createMockAssetItem({
            name: scenario.assetName,
            hash: scenario.assetHash
          })
        ]
      )

      expect(addValueControlWidgets).toHaveBeenCalledWith(
        mockNode,
        widget,
        'randomize',
        undefined,
        [
          'COMBO',
          {
            control_after_generate: true,
            name: scenario.inputName,
            type: 'COMBO'
          }
        ]
      )
    })

    it('should create normal combo widget for non-input nodes in cloud', () => {
      const scenario = cloudInputScenarios[0]
      mockDistributionState.isCloud = true

      const constructor = useComboWidget()
      const mockWidget = createMockWidget()
      const mockNode = createMockNode('SomeOtherNode')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'option',
        options: [scenario.assetHash, 'other-option']
      })

      const widget = constructor(mockNode, inputSpec)

      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'combo',
        'option',
        scenario.assetHash,
        expect.any(Function),
        { values: [scenario.assetHash, 'other-option'] }
      )
      expect(widget).toBe(mockWidget)
    })

    it('should create normal combo widget for LoadImage in OSS', () => {
      const scenario = cloudInputScenarios[0]
      mockDistributionState.isCloud = false

      const constructor = useComboWidget()
      const mockWidget = createMockWidget()
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [scenario.assetHash, 'other-option']
      })

      const widget = constructor(mockNode, inputSpec)

      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'combo',
        'image',
        scenario.assetHash,
        expect.any(Function),
        {
          values: [scenario.assetHash, 'other-option']
        }
      )
      expect(widget).toBe(mockWidget)
    })

    it('should trigger lazy load for cloud input nodes', () => {
      const scenario = cloudInputScenarios[0]
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = []
      mockAssetsStoreState.inputLoading = false

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({ type: 'combo' })
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [scenario.assetHash]
      })

      constructor(mockNode, inputSpec)

      expect(mockUpdateInputs).toHaveBeenCalledTimes(1)
    })

    it('should keep empty cloud input value after lazy-loaded inputs resolve a default', async () => {
      const scenario = cloudInputScenarios[0]
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = []
      mockAssetsStoreState.inputLoading = false
      mockUpdateInputs.mockImplementationOnce(async () => {
        mockAssetsStoreState.inputAssets = [
          createMockAssetItem({
            name: scenario.assetName,
            hash: scenario.assetHash
          })
        ]
      })

      const constructor = useComboWidget()
      const mockNode = createMockNode(scenario.nodeClass)
      const inputSpec = createMockInputSpec({
        name: scenario.inputName,
        default: scenario.assetName
      })

      const widget = constructor(mockNode, inputSpec)

      expect(mockUpdateInputs).toHaveBeenCalledTimes(1)
      expect(getInputWidgetDefault(mockNode)).toBe('')
      expect(widget.value).toBe('')

      await mockUpdateInputs.mock.results[0]?.value

      expect(getInputWidgetValues(mockNode)).toEqual([scenario.assetHash])
      expect(widget.value).toBe('')
    })

    it('should not trigger lazy load if assets already loading', () => {
      const scenario = cloudInputScenarios[0]
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = []
      mockAssetsStoreState.inputLoading = true

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({ type: 'combo' })
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [scenario.assetHash]
      })

      constructor(mockNode, inputSpec)

      expect(mockUpdateInputs).not.toHaveBeenCalled()
    })

    it('should not trigger lazy load if assets already loaded', () => {
      const scenario = cloudInputScenarios[0]
      mockDistributionState.isCloud = true
      mockAssetsStoreState.inputAssets = [
        createMockAssetItem({
          id: 'asset-123',
          name: scenario.assetName,
          hash: scenario.assetHash
        })
      ]
      mockAssetsStoreState.inputLoading = false

      const constructor = useComboWidget()
      const mockWidget = createMockWidget({ type: 'combo' })
      const mockNode = createMockNode('LoadImage')
      vi.mocked(mockNode.addWidget).mockReturnValue(mockWidget)
      const inputSpec = createMockInputSpec({
        name: 'image',
        options: [scenario.assetHash]
      })

      constructor(mockNode, inputSpec)

      expect(mockUpdateInputs).not.toHaveBeenCalled()
    })
  })
})
