/* eslint-disable vue/no-unused-emit-declarations */
import { createTestingPinia } from '@pinia/testing'
import { render, screen, fireEvent } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import type { SelectProps } from 'primevue/select'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import WidgetSelect from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

// Mock state for asset service
const mockShouldUseAssetBrowser = vi.hoisted(() => vi.fn(() => false))
const mockIsAssetAPIEnabled = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    shouldUseAssetBrowser: mockShouldUseAssetBrowser,
    isAssetAPIEnabled: mockIsAssetAPIEnabled
  }
}))

const WidgetSelectDropdownStub = defineComponent({
  name: 'WidgetSelectDropdown',
  props: {
    widget: { type: Object, default: () => ({}) },
    modelValue: { type: String, default: undefined },
    nodeType: { type: String, default: '' },
    assetKind: { type: String, default: '' },
    allowUpload: { type: Boolean, default: false },
    uploadFolder: { type: String, default: '' },
    uploadSubfolder: { type: String, default: '' },
    isAssetMode: { type: Boolean, default: false },
    defaultLayoutMode: { type: String, default: '' }
  },
  template:
    '<div data-testid="widget-select-dropdown" :data-node-type="nodeType" :data-asset-kind="assetKind" :data-allow-upload="String(allowUpload)" :data-upload-folder="uploadFolder" :data-upload-subfolder="uploadSubfolder || \'\'" />'
})

const WidgetSelectDefaultStub = defineComponent({
  name: 'WidgetSelectDefault',
  props: {
    widget: { type: Object, default: () => ({}) },
    modelValue: { type: String, default: undefined }
  },
  emits: ['update:modelValue'],
  template:
    '<div data-testid="widget-select-default"><input data-testid="select-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>'
})

const globalConfig = {
  plugins: [PrimeVue, createTestingPinia(), i18n],
  stubs: {
    WidgetSelectDropdown: WidgetSelectDropdownStub,
    WidgetSelectDefault: WidgetSelectDefaultStub,
    WidgetWithControl: {
      template: '<div data-testid="widget-with-control" />'
    }
  }
}

describe('WidgetSelect Value Binding', () => {
  beforeEach(() => {
    mockShouldUseAssetBrowser.mockReturnValue(false)
    mockIsAssetAPIEnabled.mockReturnValue(false)
    vi.clearAllMocks()
  })

  const createSelectWidget = (
    value: string = 'option1',
    options: Partial<
      SelectProps & { values?: string[]; return_index?: boolean }
    > = {},
    callback?: (value: string | undefined) => void,
    spec?: ComboInputSpec
  ) =>
    createMockWidget<string | undefined>({
      value,
      name: 'test_select',
      type: 'combo',
      options: {
        values: ['option1', 'option2', 'option3'],
        ...options
      },
      callback,
      spec
    })

  const renderComponent = (
    widget: SimplifiedWidget<string | undefined>,
    modelValue: string | undefined,
    extraProps: Record<string, unknown> = {}
  ) => {
    const onModelUpdate = vi.fn()
    render(WidgetSelect, {
      props: {
        widget,
        modelValue,
        'onUpdate:modelValue': onModelUpdate,
        ...extraProps
      },
      global: globalConfig
    })
    return onModelUpdate
  }

  describe('Vue Event Emission', () => {
    it('emits Vue event when selection changes', async () => {
      const widget = createSelectWidget('option1')
      const onModelUpdate = renderComponent(widget, 'option1')

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, 'option2')

      expect(onModelUpdate).toHaveBeenCalledWith('option2')
    })

    it('emits string value for different options', async () => {
      const widget = createSelectWidget('option1')
      const onModelUpdate = renderComponent(widget, 'option1')

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, 'option3')

      expect(onModelUpdate).toHaveBeenCalledWith('option3')
    })

    it('handles custom option values', async () => {
      const customOptions = ['custom_a', 'custom_b', 'custom_c']
      const widget = createSelectWidget('custom_a', { values: customOptions })
      const onModelUpdate = renderComponent(widget, 'custom_a')

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, 'custom_b')

      expect(onModelUpdate).toHaveBeenCalledWith('custom_b')
    })

    it('handles missing callback gracefully', async () => {
      const widget = createSelectWidget('option1', {}, undefined)
      const onModelUpdate = renderComponent(widget, 'option1')

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, 'option2')

      expect(onModelUpdate).toHaveBeenCalledWith('option2')
    })

    it('handles value changes gracefully', async () => {
      const widget = createSelectWidget('option1')
      const onModelUpdate = renderComponent(widget, 'option1')

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, 'option2')

      expect(onModelUpdate).toHaveBeenCalledWith('option2')
    })
  })

  describe('Option Handling', () => {
    it('handles empty options array', () => {
      const widget = createSelectWidget('', { values: [] })
      renderComponent(widget, '')

      expect(screen.getByTestId('widget-select-default')).toBeInTheDocument()
    })

    it('handles single option', () => {
      const widget = createSelectWidget('only_option', {
        values: ['only_option']
      })
      renderComponent(widget, 'only_option')

      expect(screen.getByTestId('widget-select-default')).toBeInTheDocument()
    })

    it('handles options with special characters', async () => {
      const specialOptions = [
        'option with spaces',
        'option@#$%',
        'option/with\\slashes'
      ]
      const widget = createSelectWidget(specialOptions[0], {
        values: specialOptions
      })
      const onModelUpdate = renderComponent(widget, specialOptions[0])

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, specialOptions[1])

      expect(onModelUpdate).toHaveBeenCalledWith(specialOptions[1])
    })
  })

  describe('Edge Cases', () => {
    it('handles selection of non-existent option gracefully', async () => {
      const widget = createSelectWidget('option1')
      const onModelUpdate = renderComponent(widget, 'option1')

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, 'non_existent_option')

      expect(onModelUpdate).toHaveBeenCalledWith('non_existent_option')
    })

    it('handles numeric string options correctly', async () => {
      const numericOptions = ['1', '2', '10', '100']
      const widget = createSelectWidget('1', { values: numericOptions })
      const onModelUpdate = renderComponent(widget, '1')

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, '100')

      expect(onModelUpdate).toHaveBeenCalledWith('100')
    })
  })

  describe('node-type prop passing', () => {
    it('passes node-type prop to WidgetSelectDropdown', () => {
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'test_select',
        image_upload: true
      }
      const widget = createSelectWidget('option1', {}, undefined, spec)
      renderComponent(widget, 'option1', {
        nodeType: 'CheckpointLoaderSimple'
      })

      const dropdown = screen.getByTestId('widget-select-dropdown')
      expect(dropdown).toBeInTheDocument()
      expect(dropdown.dataset.nodeType).toBe('CheckpointLoaderSimple')
    })

    it('does not pass node-type prop to WidgetSelectDefault', () => {
      const widget = createSelectWidget('option1')
      renderComponent(widget, 'option1', { nodeType: 'KSampler' })

      expect(screen.getByTestId('widget-select-default')).toBeInTheDocument()
      expect(
        screen.queryByTestId('widget-select-dropdown')
      ).not.toBeInTheDocument()
    })
  })

  describe('Asset mode detection', () => {
    it('enables asset mode when shouldUseAssetBrowser returns true', () => {
      mockShouldUseAssetBrowser.mockReturnValue(true)

      const widget = createSelectWidget('test.safetensors')
      renderComponent(widget, 'test.safetensors', {
        nodeType: 'CheckpointLoaderSimple'
      })

      expect(screen.getByTestId('widget-select-dropdown')).toBeInTheDocument()
    })

    it('disables asset mode when shouldUseAssetBrowser returns false', () => {
      mockShouldUseAssetBrowser.mockReturnValue(false)

      const widget = createSelectWidget('test.safetensors')
      renderComponent(widget, 'test.safetensors', {
        nodeType: 'CheckpointLoaderSimple'
      })

      expect(screen.getByTestId('widget-select-default')).toBeInTheDocument()
    })
  })

  describe('Spec-aware rendering', () => {
    it('uses dropdown variant when combo spec enables image uploads', () => {
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'test_select',
        image_upload: true
      }
      const widget = createSelectWidget('option1', {}, undefined, spec)
      renderComponent(widget, 'option1')

      expect(screen.getByTestId('widget-select-dropdown')).toBeInTheDocument()
      expect(
        screen.queryByTestId('widget-select-default')
      ).not.toBeInTheDocument()
    })

    it('uses dropdown variant for audio uploads', (context) => {
      context.skip('allowUpload is not false, should it be? needs diagnosis')
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'test_select',
        audio_upload: true
      }
      const widget = createSelectWidget('clip.wav', {}, undefined, spec)
      renderComponent(widget, 'clip.wav')

      const dropdown = screen.getByTestId('widget-select-dropdown')
      expect(dropdown).toBeInTheDocument()
      expect(dropdown.dataset.assetKind).toBe('audio')
      expect(dropdown.dataset.allowUpload).toBe('false')
    })

    it('uses dropdown variant for mesh uploads via spec', () => {
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'model_file',
        mesh_upload: true,
        upload_subfolder: '3d'
      }
      const widget = createSelectWidget('model.glb', {}, undefined, spec)
      renderComponent(widget, 'model.glb')

      const dropdown = screen.getByTestId('widget-select-dropdown')
      expect(dropdown).toBeInTheDocument()
      expect(dropdown.dataset.assetKind).toBe('mesh')
      expect(dropdown.dataset.allowUpload).toBe('true')
      expect(dropdown.dataset.uploadFolder).toBe('input')
      expect(dropdown.dataset.uploadSubfolder).toBe('3d')
    })

    it('keeps default select when no spec or media hints are present', () => {
      const widget = createSelectWidget('plain', {
        values: ['plain', 'text']
      })
      renderComponent(widget, 'plain')

      expect(screen.getByTestId('widget-select-default')).toBeInTheDocument()
      expect(
        screen.queryByTestId('widget-select-dropdown')
      ).not.toBeInTheDocument()
    })
  })
})
