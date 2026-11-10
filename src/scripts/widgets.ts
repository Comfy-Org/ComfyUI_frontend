import { createApp, h, shallowReactive, shallowRef } from 'vue'

import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import Button from '@comfyorg/design-system/button/Button'
import { i18n } from '@/i18n'
import WidgetLayoutField from '@/renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue'
import type { NumberInputOptions } from '@/types/numberInput'
import { dynamicWidgets } from '@/core/graph/widgets/dynamicWidgets'
import {
  addValueControlWidget as _addValueControlWidget,
  addValueControlWidgets as _addValueControlWidgets,
  updateControlWidgetLabel as _updateControlWidgetLabel
} from '@/core/graph/widgets/valueControlWidgets'
import { useBooleanWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBooleanWidget'
import { useBoundingBoxWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget'
import { useCurveWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useCurveWidget'
import { useChartWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useChartWidget'
import { useColorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget'
import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
import { useCompositorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useCompositorWidget'
import { useFloatWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget'
import { useGalleriaWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget'
import { useBoundingBoxesWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesWidget'
import { useLightInfoWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useLightInfoWidget'
import { useColorsWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorsWidget'
import { useImageCompareWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget'
import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import { useIntWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useIntWidget'
import { useMarkdownWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget'
import { usePainterWidget } from '@/renderer/extensions/vueNodes/widgets/composables/usePainterWidget'
import { useRangeWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useRangeWidget'
import { useResolutionPreviewWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useResolutionPreviewWidget'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
import { useTextareaWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useTextareaWidget'
import { useVideoConcatWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useVideoConcatWidget'
import { useVideoEditWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useVideoEditWidget'
import { transformInputSpecV1ToV2 } from '@comfyorg/object-info-parser/migration'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

import type { ComfyWidgetConstructor } from '@/types/comfy'

import './domWidget'

/**
 * Transforms a V2 widget constructor to a V1 widget constructor.
 * @param widgetConstructorV2 The V2 widget constructor to transform.
 * @returns The transformed V1 widget constructor.
 */
const transformWidgetConstructorV2ToV1 = (
  widgetConstructorV2: ComfyWidgetConstructorV2
): ComfyWidgetConstructor => {
  return (node, inputName, inputData) => {
    const inputSpec = transformInputSpecV1ToV2(inputData, {
      name: inputName
    })
    const widget = widgetConstructorV2(node, inputSpec)
    return {
      widget,
      minWidth: widget.options.minNodeSize?.[0],
      minHeight: widget.options.minNodeSize?.[1]
    }
  }
}

export const ComfyWidgets = {
  INT: transformWidgetConstructorV2ToV1(useIntWidget()),
  FLOAT: transformWidgetConstructorV2ToV1(useFloatWidget()),
  BOOLEAN: transformWidgetConstructorV2ToV1(useBooleanWidget()),
  STRING: transformWidgetConstructorV2ToV1(useStringWidget()),
  MARKDOWN: transformWidgetConstructorV2ToV1(useMarkdownWidget()),
  COMBO: transformWidgetConstructorV2ToV1(useComboWidget()),
  IMAGEUPLOAD: useImageUploadWidget(),
  COLOR: transformWidgetConstructorV2ToV1(useColorWidget()),
  IMAGECOMPARE: transformWidgetConstructorV2ToV1(useImageCompareWidget()),
  BOUNDING_BOX: transformWidgetConstructorV2ToV1(useBoundingBoxWidget()),
  CHART: transformWidgetConstructorV2ToV1(useChartWidget()),
  GALLERIA: transformWidgetConstructorV2ToV1(useGalleriaWidget()),
  PAINTER: transformWidgetConstructorV2ToV1(usePainterWidget()),
  COMPOSITOR: transformWidgetConstructorV2ToV1(useCompositorWidget()),
  TEXTAREA: transformWidgetConstructorV2ToV1(useTextareaWidget()),
  CURVE: transformWidgetConstructorV2ToV1(useCurveWidget()),
  RANGE: transformWidgetConstructorV2ToV1(useRangeWidget()),
  VIDEO_EDIT: transformWidgetConstructorV2ToV1(useVideoEditWidget()),
  VIDEO_CONCAT: transformWidgetConstructorV2ToV1(useVideoConcatWidget()),
  RESOLUTION_PREVIEW: transformWidgetConstructorV2ToV1(
    useResolutionPreviewWidget()
  ),
  BOUNDING_BOXES: transformWidgetConstructorV2ToV1(useBoundingBoxesWidget()),
  LIGHT_INFO_PREVIEW: transformWidgetConstructorV2ToV1(useLightInfoWidget()),
  COLORS: transformWidgetConstructorV2ToV1(useColorsWidget()),
  ...dynamicWidgets
} as const

export function isValidWidgetType(
  key: unknown
): key is keyof typeof ComfyWidgets {
  return typeof key === 'string' && Object.hasOwn(ComfyWidgets, key)
}

export const addValueControlWidget = _addValueControlWidget
export const addValueControlWidgets = _addValueControlWidgets
export const updateControlWidgetLabel = _updateControlWidgetLabel

export function createNumberInput(options: NumberInputOptions) {
  const state = shallowReactive({ ...options })
  const control = shallowRef<InstanceType<typeof ScrubableNumberInput>>()
  const element = document.createElement('div')
  element.className =
    'grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] px-3 text-xs text-foreground'
  let app: ReturnType<typeof createApp> | undefined
  function mount() {
    if (app) return
    app = createApp({
      render() {
        return h(
          WidgetLayoutField,
          { widget: { name: state.name }, rootClass: 'col-span-full' },
          () =>
            h(
              ScrubableNumberInput,
              {
                ref: control,
                modelValue: state.value,
                displayValue: state.displayValue,
                disabled: state.disabled,
                onInteraction: state.onInteraction,
                inputAttrs: {
                  'aria-label': state.name,
                  onFocus: () => control.value?.edit()
                }
              },
              () => [
                state.annotation &&
                  h(
                    'span',
                    { class: 'content-center truncate text-muted-foreground' },
                    state.annotation
                  ),
                state.unit &&
                  h(
                    'span',
                    { class: 'content-center text-muted-foreground' },
                    state.unit
                  ),
                state.action &&
                  h(
                    Button,
                    {
                      'aria-label': state.action.label,
                      title: state.action.label,
                      disabled: state.disabled || state.action.disabled,
                      variant: 'muted-textonly',
                      size: 'unset',
                      class: 'aspect-square h-full rounded-none p-0',
                      tabindex: -1,
                      onClick: state.action.onClick
                    },
                    () =>
                      h('i', {
                        class:
                          state.action?.icon === 'disable'
                            ? 'icon-[lucide--ban]'
                            : 'icon-[lucide--rotate-ccw]'
                      })
                  )
              ]
            )
        )
      }
    })
    app.use(i18n).mount(element)
  }
  mount()
  for (const type of [
    'keydown',
    'keyup',
    'pointerdown',
    'pointermove',
    'pointerup',
    'dblclick'
  ]) {
    element.addEventListener(type, (event) => event.stopPropagation())
  }
  return {
    element,
    mount,
    update(next: Partial<NumberInputOptions>) {
      Object.assign(state, next)
    },
    edit() {
      control.value?.edit()
    },
    destroy() {
      app?.unmount()
      app = undefined
    }
  }
}
