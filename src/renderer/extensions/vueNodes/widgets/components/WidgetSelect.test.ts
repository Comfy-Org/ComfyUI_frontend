import { getActivePinia } from 'pinia'
import { render, screen, fireEvent, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComboInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import { assetService } from '@/platform/assets/services/assetService'
import WidgetSelect from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue'
import { app } from '@/scripts/app'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { addControlledWidget } from './controlledWidgetFixture'
import { registerTestWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

vi.mock(import('@/platform/assets/services/assetService'), { spy: true })
vi.mock(import('@/scripts/app'))

const WidgetSelectDropdownStub = defineComponent({
  name: 'WidgetSelectDropdown',
  props: {
    widgetId: { type: String, required: true },
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
    widgetId: { type: String, required: true },
    modelValue: { type: String, default: undefined }
  },
  emits: ['update:modelValue'],
  template:
    '<div data-testid="widget-select-default"><input data-testid="select-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>'
})

const globalConfig = {
  stubs: {
    WidgetSelectDropdown: WidgetSelectDropdownStub,
    WidgetSelectDefault: WidgetSelectDefaultStub,
    WidgetWithControl: {
      props: { widgetId: String, component: Object },
      template:
        '<div data-testid="widget-with-control" :data-widget-id="widgetId"><component :is="component" :widget-id="widgetId" /></div>'
    }
  }
}

it.for([
  {
    name: 'model',
    eligible: true,
    value: 'studio/model.safetensors',
    expected: 'model.safetensors'
  },
  {
    name: 'schedule',
    eligible: false,
    value: 'schedule/custom',
    expected: 'schedule/custom'
  }
])('summarizes $name', ({ name, eligible, value, expected }) => {
  vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(eligible)
  render(WidgetSelect, {
    props: {
      widgetId: registerTestWidget({
        name,
        type: 'combo',
        value,
        options: { values: [value] }
      }),
      nodeType: 'ModelLoader',
      modelValue: value
    },
    global: {
      plugins: [i18n]
    }
  })
  expect(screen.getByRole('combobox').textContent.trim()).toBe(expected)
})

describe('WidgetSelect Value Binding', () => {
  type SelectWidgetOptions = {
    values?: string[]
    return_index?: boolean
  }

  const createSelectWidget = (
    value: string = 'option1',
    options: SelectWidgetOptions = {},
    spec?: ComboInputSpec
  ) =>
    registerTestWidget(
      {
        value,
        name: 'test_select',
        type: 'combo',
        options: {
          values: ['option1', 'option2', 'option3'],
          ...options
        }
      },
      { spec }
    )

  const renderComponent = (
    widgetId: WidgetId,
    modelValue: string | undefined,
    extraProps: Record<string, unknown> = {}
  ) => {
    const onModelUpdate = vi.fn()
    render(WidgetSelect, {
      props: {
        widgetId,
        modelValue,
        'onUpdate:modelValue': onModelUpdate,
        ...extraProps
      },
      global: { ...globalConfig, plugins: [getActivePinia()!, i18n] }
    })
    return onModelUpdate
  }

  describe('Vue Event Emission', () => {
    it('forwards model updates from the default select', async () => {
      const widget = createSelectWidget('option1')
      const onModelUpdate = renderComponent(widget, 'option1')

      const input = screen.getByTestId('select-input')
      await fireEvent.update(input, 'option2')

      expect(onModelUpdate).toHaveBeenCalledWith('option2')
    })
  })

  describe('Value control', () => {
    it('wraps the default select when the combo has a value control', () => {
      const { graph, widgetId } = addControlledWidget({
        type: 'combo',
        value: 'option1',
        options: { values: ['option1', 'option2'] }
      })
      vi.mocked(app).rootGraph = graph
      renderComponent(widgetId, 'option1')

      const wrapper = screen.getByTestId('widget-with-control')
      expect(wrapper).toHaveAttribute('data-widget-id', widgetId)
      expect(
        within(wrapper).getByTestId('widget-select-default')
      ).toBeInTheDocument()
      expect(screen.getAllByTestId('widget-select-default')).toHaveLength(1)
    })
  })

  describe('Asset mode detection', () => {
    it('enables asset mode when shouldUseWidgetAssetPicker returns true', () => {
      vi.mocked(assetService.shouldUseWidgetAssetPicker).mockReturnValue(true)

      const widget = createSelectWidget('test.safetensors')
      renderComponent(widget, 'test.safetensors', {
        nodeType: 'CheckpointLoaderSimple'
      })

      expect(screen.getByTestId('widget-select-dropdown')).toBeInTheDocument()
    })

    it('disables asset mode when shouldUseWidgetAssetPicker returns false', () => {
      vi.mocked(assetService.shouldUseWidgetAssetPicker).mockReturnValue(false)

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
      const widget = createSelectWidget('option1', {}, spec)
      renderComponent(widget, 'option1')

      expect(screen.getByTestId('widget-select-dropdown')).toBeInTheDocument()
      expect(
        screen.queryByTestId('widget-select-default')
      ).not.toBeInTheDocument()
    })

    it('uses dropdown variant for audio uploads', () => {
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'test_select',
        audio_upload: true
      }
      const widget = createSelectWidget('clip.wav', {}, spec)
      renderComponent(widget, 'clip.wav')

      expect(screen.getByTestId('widget-select-dropdown')).toBeInTheDocument()
    })

    it('uses dropdown variant for mesh uploads via spec', () => {
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'model_file',
        mesh_upload: true,
        upload_subfolder: '3d'
      }
      const widget = createSelectWidget('model.glb', {}, spec)
      renderComponent(widget, 'model.glb')

      expect(screen.getByTestId('widget-select-dropdown')).toBeInTheDocument()
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
