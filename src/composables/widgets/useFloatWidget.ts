import type { LGraphNode } from '@comfyorg/litegraph'
import type { INumericWidget } from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

import { type InputSpec, isFloatInputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useSettingStore } from '@/stores/settingStore'

function onFloatValueChange(this: INumericWidget, v: number) {
  this.value = this.options.round
    ? _.clamp(
        Math.round((v + Number.EPSILON) / this.options.round) *
          this.options.round,
        this.options.min ?? -Infinity,
        this.options.max ?? Infinity
      )
    : v
}

export const _for_testing = {
  onFloatValueChange
}

export const useFloatWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec
  ) => {
    if (!isFloatInputSpec(inputData)) {
      throw new Error(`Invalid input data: ${inputData}`)
    }

    // TODO: Move to outer scope to avoid re-initializing on every call
    // Blocked on ComfyWidgets lazy initialization.

    const settingStore = useSettingStore()
    const sliderEnabled = !settingStore.get('Comfy.DisableSliders')
    const inputOptions = inputData[1] ?? {}

    const display_type = inputOptions?.display
    const widgetType =
      sliderEnabled && display_type == 'slider'
        ? 'slider'
        : display_type == 'knob'
          ? 'knob'
          : 'number'

    const step = inputOptions.step ?? 0.5
    const precision =
      settingStore.get('Comfy.FloatRoundingPrecision') ||
      Math.max(0, -Math.floor(Math.log10(step)))
    const enableRounding = !settingStore.get('Comfy.DisableFloatRounding')

    const defaultValue = inputOptions.default ?? 0
    return {
      widget: node.addWidget(
        widgetType,
        inputName,
        defaultValue,
        onFloatValueChange,
        {
          min: inputOptions.min ?? 0,
          max: inputOptions.max ?? 2048,
          round:
            enableRounding && precision && !inputOptions.round
              ? (1_000_000 * Math.pow(0.1, precision)) / 1_000_000
              : (inputOptions.round as number),
          /** @deprecated Use step2 instead. The 10x value is a legacy implementation. */
          step: step * 10.0,
          step2: step,
          precision
        }
      )
    }
  }

  return widgetConstructor
}
