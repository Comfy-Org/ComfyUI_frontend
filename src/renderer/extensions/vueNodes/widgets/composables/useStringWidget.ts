import { isMiddlePointerInput } from '@/base/pointerUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/litegraph'
import { defineDeprecatedProperty } from '@/lib/litegraph/src/utils/feedback'
import { useSettingStore } from '@/platform/settings/settingStore'
import { isStringInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

const TRACKPAD_DETECTION_THRESHOLD = 50

// TODO: This widget manually syncs with widgetValueStore via getValue/setValue.
// Consolidate with useMarkdownWidget into shared helpers (domWidgetHelpers.ts).
function addMultilineWidget(
  node: LGraphNode,
  name: string,
  opts: { defaultVal: string; placeholder?: string }
) {
  const widgetStore = useWidgetValueStore()
  const inputEl = document.createElement('textarea')
  inputEl.className = 'comfy-multiline-input'
  inputEl.dataset.testid = 'dom-widget-textarea'
  inputEl.value = opts.defaultVal
  inputEl.placeholder = opts.placeholder || name
  inputEl.spellcheck = useSettingStore().get('Comfy.TextareaWidget.Spellcheck')

  const widget = node.addDOMWidget(name, 'customtext', inputEl, {
    getValue(): string {
      const graphId = resolveNodeRootGraphId(node, app.rootGraph.id)
      const widgetState = widgetStore.getWidget(graphId, node.id, name)

      return (widgetState?.value as string) ?? inputEl.value
    },
    setValue(v: string) {
      inputEl.value = v
      const graphId = resolveNodeRootGraphId(node, app.rootGraph.id)
      const widgetState = widgetStore.getWidget(graphId, node.id, name)
      if (widgetState) widgetState.value = v
    }
  })

  widget.element = inputEl

  /** @deprecated Use {@link widget.element} instead (renamed in PR #8594). */
  defineDeprecatedProperty(
    widget,
    'inputEl',
    'element',
    'widget.inputEl is deprecated. Use widget.element instead.'
  )
  widget.options.minNodeSize = [400, 200]

  inputEl.addEventListener('input', (event) => {
    if (event.target instanceof HTMLTextAreaElement) {
      widget.value = event.target.value
    }
    widget.callback?.(widget.value)
  })

  inputEl.addEventListener('pointerdown', (event: PointerEvent) => {
    if (isMiddlePointerInput(event)) {
      app.canvas.processMouseDown(event)
    }
  })

  inputEl.addEventListener('pointermove', (event: PointerEvent) => {
    if (isMiddlePointerInput(event)) {
      app.canvas.processMouseMove(event)
    }
  })

  inputEl.addEventListener('pointerup', (event: PointerEvent) => {
    if (isMiddlePointerInput(event)) {
      app.canvas.processMouseUp(event)
    }
  })

  inputEl.addEventListener('wheel', (event: WheelEvent) => {
    const gesturesEnabled = useSettingStore().get(
      'LiteGraph.Pointer.TrackpadGestures'
    )
    const deltaX = event.deltaX
    const deltaY = event.deltaY

    const canScrollY = inputEl.scrollHeight > inputEl.clientHeight
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)

    // Prevent pinch zoom from zooming the page
    if (event.ctrlKey) {
      event.preventDefault()
      event.stopPropagation()
      app.canvas.processMouseWheel(event)
      return
    }

    // Detect if this is likely a trackpad gesture vs mouse wheel
    // Trackpads usually have deltaX or smaller deltaY values (< TRACKPAD_DETECTION_THRESHOLD)
    // Mouse wheels typically have larger discrete deltaY values (>= TRACKPAD_DETECTION_THRESHOLD)
    const isLikelyTrackpad =
      Math.abs(deltaX) > 0 || Math.abs(deltaY) < TRACKPAD_DETECTION_THRESHOLD

    // Trackpad gestures: when enabled, trackpad panning goes to canvas
    if (gesturesEnabled && isLikelyTrackpad) {
      event.preventDefault()
      event.stopPropagation()
      app.canvas.processMouseWheel(event)
      return
    }

    // When gestures disabled: horizontal always goes to canvas (no horizontal scroll in textarea)
    if (isHorizontal) {
      event.preventDefault()
      event.stopPropagation()
      app.canvas.processMouseWheel(event)
      return
    }

    // Vertical scrolling when gestures disabled: let textarea scroll if scrollable
    if (canScrollY) {
      event.stopPropagation()
      return
    }

    // If textarea can't scroll vertically, pass to canvas
    event.preventDefault()
    app.canvas.processMouseWheel(event)
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
