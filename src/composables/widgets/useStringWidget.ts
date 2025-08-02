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

  /** Timer reference. `null` when the timer completes. */
  let ignoreEventsTimer: ReturnType<typeof setTimeout> | null = null
  /** Total number of events ignored since the timer started. */
  let ignoredEvents = 0

  // Pass wheel events to the canvas when appropriate
  inputEl.addEventListener('wheel', (event: WheelEvent) => {
    if (!Object.is(event.deltaX, -0)) return

    // If the textarea has focus, require more effort to activate pass-through
    const multiplier = document.activeElement === inputEl ? 2 : 1
    const maxScrollHeight = inputEl.scrollHeight - inputEl.clientHeight

    if (
      (event.deltaY < 0 && inputEl.scrollTop === 0) ||
      (event.deltaY > 0 && inputEl.scrollTop === maxScrollHeight)
    ) {
      // Attempting to scroll past the end of the textarea
      if (!ignoreEventsTimer || ignoredEvents > 25 * multiplier) {
        app.canvas.processMouseWheel(event)
      } else {
        ignoredEvents++
      }
    } else if (event.deltaY !== 0) {
      // Start timer whenever a successful scroll occurs
      ignoredEvents = 0
      if (ignoreEventsTimer) clearTimeout(ignoreEventsTimer)

      ignoreEventsTimer = setTimeout(() => {
        ignoreEventsTimer = null
      }, 800 * multiplier)
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
