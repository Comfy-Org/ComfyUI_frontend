import { type LGraphNode, isComboWidget } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { registerWidgetControlFromConfig } from '@/core/graph/widgets/control/widgetControl'
import { isValueControlMode } from '@/core/graph/widgets/control/valueControl'
import type { ValueControlMode } from '@/core/graph/widgets/control/valueControl'
import { dynamicWidgets } from '@/core/graph/widgets/dynamicWidgets'
import { useBooleanWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBooleanWidget'
import { useBoundingBoxWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget'
import { useCurveWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useCurveWidget'
import { useChartWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useChartWidget'
import { useColorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget'
import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
import { useFloatWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget'
import { useGalleriaWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget'
import { useImageCompareWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget'
import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import { useIntWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useIntWidget'
import { useMarkdownWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget'
import { usePainterWidget } from '@/renderer/extensions/vueNodes/widgets/composables/usePainterWidget'
import { useRangeWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useRangeWidget'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
import { useTextareaWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useTextareaWidget'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDefSchema'

import type { ComfyApp } from './app'
import './domWidget'
import './errorNodeWidgets'

export type ComfyWidgetConstructorV2 = (
  node: LGraphNode,
  inputSpec: InputSpecV2
) => IBaseWidget

export type ComfyWidgetConstructor = (
  node: LGraphNode,
  inputName: string,
  inputData: InputSpec,
  app: ComfyApp,
  widgetName?: string
) => { widget: IBaseWidget; minWidth?: number; minHeight?: number }

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

function toControlMode(value: string | undefined): ValueControlMode {
  return isValueControlMode(value) ? value : 'randomize'
}

/** Attaches a value-control component to a target widget (number controls). */
export function addValueControlWidget(
  targetWidget: IBaseWidget,
  defaultValue?: string
): void {
  targetWidget.controlConfig = {
    mode: toControlMode(defaultValue),
    hasFilter: false
  }
  registerWidgetControlFromConfig(targetWidget)
}

/** Attaches a value-control component, adding a filter slot for combo targets. */
export function addValueControlWidgets(
  targetWidget: IBaseWidget,
  defaultValue?: string,
  { addFilterList = true }: { addFilterList?: boolean } = {}
): void {
  targetWidget.controlConfig = {
    mode: toControlMode(defaultValue),
    hasFilter: isComboWidget(targetWidget) && addFilterList
  }
  registerWidgetControlFromConfig(targetWidget)
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
  TEXTAREA: transformWidgetConstructorV2ToV1(useTextareaWidget()),
  CURVE: transformWidgetConstructorV2ToV1(useCurveWidget()),
  RANGE: transformWidgetConstructorV2ToV1(useRangeWidget()),
  ...dynamicWidgets
} as const

export function isValidWidgetType(
  key: unknown
): key is keyof typeof ComfyWidgets {
  return ComfyWidgets[key as keyof typeof ComfyWidgets] !== undefined
}
