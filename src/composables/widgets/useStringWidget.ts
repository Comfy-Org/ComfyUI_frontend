import type { IWidget, LGraphNode } from '@comfyorg/litegraph'

import { type InputSpec, isStringInputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useSettingStore } from '@/stores/settingStore'
import type { ComfyApp } from '@/types'

function addMultilineWidget(
  node: LGraphNode,
  name: string,
  opts: { defaultVal: string; placeholder?: string },
  app: ComfyApp
) {
  const inputEl = document.createElement('textarea')
  inputEl.className = 'comfy-multiline-input'
  inputEl.value = opts.defaultVal
  inputEl.placeholder = opts.placeholder || name
  if (app.vueAppReady) {
    inputEl.spellcheck = useSettingStore().get(
      'Comfy.TextareaWidget.Spellcheck'
    )
  }

  const widget = node.addDOMWidget(name, 'customtext', inputEl, {
    getValue(): string {
      return inputEl.value
    },
    setValue(v: string) {
      inputEl.value = v
    }
  })

  widget.inputEl = inputEl

  inputEl.addEventListener('input', () => {
    widget.callback?.(widget.value)
  })

  inputEl.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button === 1) {
      app.canvas.processMouseDown(event)
    }
  })

  inputEl.addEventListener('pointermove', (event: PointerEvent) => {
    if ((event.buttons & 4) === 4) {
      app.canvas.processMouseMove(event)
    }
  })

  inputEl.addEventListener('pointerup', (event: PointerEvent) => {
    if (event.button === 1) {
      app.canvas.processMouseUp(event)
    }
  })

  return { minWidth: 400, minHeight: 200, widget }
}

export const useStringWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app: ComfyApp
  ) => {
    if (!isStringInputSpec(inputData)) {
      throw new Error(`Invalid input data: ${inputData}`)
    }

    const inputOptions = inputData[1] ?? {}
    const defaultVal = inputOptions.default ?? ''
    const multiline = inputOptions.multiline

    let res: { widget: IWidget }
    if (multiline) {
      res = addMultilineWidget(
        node,
        inputName,
        { defaultVal, ...inputOptions },
        app
      )
    } else {
      res = {
        widget: node.addWidget('text', inputName, defaultVal, () => {}, {})
      }
    }

    if (typeof inputOptions.dynamicPrompts === 'boolean') {
      res.widget.dynamicPrompts = inputOptions.dynamicPrompts
    }

    return res
  }

  return widgetConstructor
}
