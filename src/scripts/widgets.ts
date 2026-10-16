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
import { useVideoEditWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useVideoEditWidget'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

import type { ComfyWidgetConstructor } from '@/types/comfy'

import './domWidget'
import './errorNodeWidgets'

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
