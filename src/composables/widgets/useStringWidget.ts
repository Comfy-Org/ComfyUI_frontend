import type { LGraphNode } from '@comfyorg/litegraph'

import {
  type InputSpec,
  isStringInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import { type ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import { useSettingStore } from '@/stores/settingStore'

function addMultilineWidget(
  node: LGraphNode,
  name: string,
  opts: { defaultVal: string; placeholder?: string }
) {
  const inputEl = document.createElement('textarea')
  inputEl.className = 'comfy-multiline-input'
  inputEl.value = opts.defaultVal
  inputEl.placeholder = opts.placeholder || name
  inputEl.spellcheck = useSettingStore().get('Comfy.TextareaWidget.Spellcheck')

  const widget = node.addDOMWidget(name, 'customtext', inputEl, {
    getValue(): string {
      return inputEl.value
    },
    setValue(v: string) {
      inputEl.value = v
    }
  })

  widget.inputEl = inputEl
  widget.options.minNodeSize = [400, 200]

  inputEl.addEventListener('input', () => {
    widget.callback?.(widget.value)
  })

  // Allow middle mouse button panning
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

  inputEl.addEventListener('wheel', (event: WheelEvent) => {
    const maxScrollHeight = inputEl.scrollHeight - inputEl.clientHeight
    const isScrollable = inputEl.scrollHeight > inputEl.clientHeight
    const isAtTop = inputEl.scrollTop === 0
    const isAtBottom = inputEl.scrollTop === maxScrollHeight

    if (isScrollable) {
      // Do not pass wheel to canvas if text can scroll
      event.stopPropagation()
      return
    }

    if ((event.deltaY < 0 && isAtTop) || (event.deltaY > 0 && isAtBottom)) {
      app.canvas.processMouseWheel(event)
    }

    if (event.ctrlKey) {
      event.stopPropagation()
    }
  })

  return widget
}

export const useStringWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isStringInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }

    const defaultVal = inputSpec.default ?? ''
    const multiline = inputSpec.multiline

    const widget = multiline
      ? addMultilineWidget(node, inputSpec.name, {
          defaultVal,
          placeholder: inputSpec.placeholder
        })
      : node.addWidget('text', inputSpec.name, defaultVal, () => {}, {})

    if (typeof inputSpec.dynamicPrompts === 'boolean') {
      widget.dynamicPrompts = inputSpec.dynamicPrompts
    }

    return widget
  }

  return widgetConstructor
}
