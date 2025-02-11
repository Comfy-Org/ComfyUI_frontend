import type { LGraphNode } from '@comfyorg/litegraph'
import type { INumericWidget } from '@comfyorg/litegraph/dist/types/widgets'

import type { ComfyApp } from '@/scripts/app'
import {
  type ComfyWidgetConstructor,
  addValueControlWidget
} from '@/scripts/widgets'
import { useSettingStore } from '@/stores/settingStore'
import { InputSpec } from '@/types/apiTypes'
import { getNumberDefaults } from '@/utils/mathUtil'

export const useIntWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app?: ComfyApp,
    widgetName?: string
  ) => {
    const settingStore = useSettingStore()
    const sliderEnabled = !settingStore.get('Comfy.DisableSliders')
    const inputOptions = inputData[1]
    const widgetType = sliderEnabled
      ? inputOptions.display === 'slider'
        ? 'slider'
        : 'number'
      : 'number'

    const { val, config } = getNumberDefaults(inputOptions, {
      defaultStep: 1,
      precision: 0,
      enableRounding: true
    })
    config.precision = 0

    const result = {
      widget: node.addWidget(
        widgetType,
        inputName,
        val,
        function (this: INumericWidget, v: number) {
          const s = (this.options.step ?? 1) / 10
          let sh = (this.options.min ?? 0) % s
          if (isNaN(sh)) {
            sh = 0
          }
          this.value = Math.round((v - sh) / s) * s + sh
        },
        config
      )
    }

    if (inputData[1]?.control_after_generate) {
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
