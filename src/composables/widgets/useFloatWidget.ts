import _ from 'es-toolkit/compat'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import {
  type InputSpec,
  isFloatInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import { type ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import { useSettingStore } from '@/stores/settingStore'

function onFloatValueChange(this: INumericWidget, v: number) {
  const round = this.options.round
  if (round) {
    const precision =
      this.options.precision ?? Math.max(0, -Math.floor(Math.log10(round)))
    const rounded = Math.round(v / round) * round
    this.value = _.clamp(
      Number(rounded.toFixed(precision)),
      this.options.min ?? -Infinity,
      this.options.max ?? Infinity
    )
  } else {
    this.value = v
  }
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

    const step = inputSpec.step ?? 0.5
    const precision =
      settingStore.get('Comfy.FloatRoundingPrecision') ||
      Math.max(0, -Math.floor(Math.log10(step)))
    const enableRounding = !settingStore.get('Comfy.DisableFloatRounding')

    /** Assertion {@link inputSpec.default} */
    const defaultValue = (inputSpec.default as number | undefined) ?? 0
    return node.addWidget(
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
  }

  return widgetConstructor
}
