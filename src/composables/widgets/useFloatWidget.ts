import type { LGraphNode } from '@comfyorg/litegraph'
import type { INumericWidget } from '@comfyorg/litegraph/dist/types/widgets'

import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useSettingStore } from '@/stores/settingStore'
import type { InputSpec } from '@/types/apiTypes'
import { getNumberDefaults } from '@/utils/mathUtil'

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
        function (this: INumericWidget, v: number) {
          if (config.round) {
            this.value =
              Math.round((v + Number.EPSILON) / config.round) * config.round
            if (this.value > config.max) this.value = config.max
            if (this.value < config.min) this.value = config.min
          } else {
            this.value = v
          }
        },
        config
      )
    }
  }

  return widgetConstructor
}
