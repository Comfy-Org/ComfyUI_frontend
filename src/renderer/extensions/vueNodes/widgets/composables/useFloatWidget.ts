import { clamp } from 'es-toolkit/compat'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { isFloatInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import { addValueControlWidget } from '@/scripts/widgets'
import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'

function onFloatValueChange(this: INumericWidget, v: number) {
  const round = this.options.round
  if (round) {
    const precision =
      this.options.precision ?? Math.max(0, -Math.floor(Math.log10(round)))
    const rounded = Math.round(v / round) * round
    this.value = clamp(
      Number(rounded.toFixed(precision)),
      this.options.min ?? -Infinity,
      this.options.max ?? Infinity
    )
  } else {
    this.value = v
  }
}

function computePrecisionFromResolution(
  resolution: number | undefined,
  defaultPrecision: number
): number {
  if (!resolution || !Number.isFinite(resolution) || resolution <= 0) {
    return defaultPrecision
  }

  const magnitude = Math.floor(Math.log10(resolution))
  const precision = Math.max(0, -magnitude)
  return precision
}

export const _for_testing = {
  onFloatValueChange
}

export const useFloatWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isFloatInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }

    const settingStore = useSettingStore()
    const sliderEnabled = !settingStore.get('Comfy.DisableSliders')

    const display_type = inputSpec.display
    const widgetType =
      sliderEnabled && display_type == 'slider'
        ? 'slider'
        : display_type == 'knob'
          ? 'knob'
          : 'number'

    const roundOption =
      typeof inputSpec.round === 'number' ? inputSpec.round : undefined
    const hasExplicitStep = typeof inputSpec.step === 'number'
    const step = hasExplicitStep ? (inputSpec.step as number) : 0.5
    const resolution = roundOption ?? (hasExplicitStep ? step : undefined)

    const autoPrecision = computePrecisionFromResolution(resolution, 3)

    const floatRoundingPrecision =
      settingStore.get('Comfy.FloatRoundingPrecision')
    const precision =
      typeof floatRoundingPrecision === 'number' &&
      floatRoundingPrecision > 0
        ? floatRoundingPrecision
        : autoPrecision

    const enableRounding = !settingStore.get('Comfy.DisableFloatRounding')

    /** Assertion {@link inputSpec.default} */
    const defaultValue = (inputSpec.default as number | undefined) ?? 0
    const widget = node.addWidget(
      widgetType,
      inputSpec.name,
      defaultValue,
      onFloatValueChange,
      {
        min: inputSpec.min ?? 0,
        max: inputSpec.max ?? 2048,
        round:
          enableRounding && precision && !inputSpec.round
            ? Math.pow(10, -precision)
            : (inputSpec.round as number),
        /** @deprecated Use step2 instead. The 10x value is a legacy implementation. */
        step: step * 10.0,
        step2: step,
        precision
      }
    )

    if (inputSpec.control_after_generate) {
      const controlWidget = addValueControlWidget(
        node,
        widget,
        'fixed',
        undefined,
        undefined,
        transformInputSpecV2ToV1(inputSpec)
      )
      widget.linkedWidgets = [controlWidget]
    }

    return widget
  }

  return widgetConstructor
}
