import type { LGraphNode } from '@comfyorg/litegraph'
import type { INumericWidget } from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

import type { InputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useSettingStore } from '@/stores/settingStore'
import { getNumberDefaults } from '@/utils/mathUtil'

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
    // TODO: Move to outer scope to avoid re-initializing on every call
    // Blocked on ComfyWidgets lazy initialization.

    const settingStore = useSettingStore()
    const sliderEnabled = !settingStore.get('Comfy.DisableSliders')
    const inputOptions = inputData[1]

    const widgetType = sliderEnabled
      ? inputOptions?.display === 'slider'
        ? 'slider'
        : 'number'
      : 'number'

    const precision =
      settingStore.get('Comfy.FloatRoundingPrecision') || undefined
    const enableRounding = !settingStore.get('Comfy.DisableFloatRounding')

    const { val, config } = getNumberDefaults(inputOptions, {
      defaultStep: 0.5,
      precision,
      enableRounding
    })

    return {
      widget: node.addWidget(
        widgetType,
        inputName,
        val,
        onFloatValueChange,
        config
      )
    }
  }

  return widgetConstructor
}
