import type { LGraphNode } from '@comfyorg/litegraph'
import type { INumericWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { type InputSpec, isIntInputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyApp } from '@/scripts/app'
import {
  type ComfyWidgetConstructor,
  addValueControlWidget
} from '@/scripts/widgets'
import { useSettingStore } from '@/stores/settingStore'

function onValueChange(this: INumericWidget, v: number) {
  // For integers, always round to the nearest step
  // step === 0 is invalid, assign 1 if options.step is 0
  const step = this.options.step2 || 1

  if (step === 1) {
    // Simple case: round to nearest integer
    this.value = Math.round(v)
  } else {
    // Round to nearest multiple of step
    // First, determine if min value creates an offset
    const min = this.options.min ?? 0
    const offset = min % step

    // Round to nearest step, accounting for offset
    this.value = Math.round((v - offset) / step) * step + offset
  }
}

export const _for_testing = {
  onValueChange
}

export const useIntWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app: ComfyApp,
    widgetName?: string
  ) => {
    if (!isIntInputSpec(inputData)) {
      throw new Error(`Invalid input data: ${inputData}`)
    }

    const settingStore = useSettingStore()
    const sliderEnabled = !settingStore.get('Comfy.DisableSliders')
    const inputOptions = inputData[1] ?? {}
    const widgetType = sliderEnabled
      ? inputOptions?.display === 'slider'
        ? 'slider'
        : 'number'
      : 'number'

    const step = inputOptions.step ?? 1
    const defaultValue = inputOptions.default ?? 0
    const result = {
      widget: node.addWidget(
        widgetType,
        inputName,
        defaultValue,
        onValueChange,
        {
          min: inputOptions.min ?? 0,
          max: inputOptions.max ?? 2048,
          /** @deprecated Use step2 instead. The 10x value is a legacy implementation. */
          step: step * 10,
          step2: step,
          precision: 0
        }
      )
    }

    if (inputOptions.control_after_generate) {
      const seedControl = addValueControlWidget(
        node,
        result.widget,
        'randomize',
        undefined,
        widgetName,
        inputData
      )
      result.widget.linkedWidgets = [seedControl]
    }

    return result
  }
  return widgetConstructor
}
