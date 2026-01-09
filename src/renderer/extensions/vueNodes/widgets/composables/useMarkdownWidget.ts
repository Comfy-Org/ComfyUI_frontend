import { Editor as TiptapEditor } from '@tiptap/core'
import TiptapLink from '@tiptap/extension-link'
import TiptapTable from '@tiptap/extension-table'
import TiptapTableCell from '@tiptap/extension-table-cell'
import TiptapTableHeader from '@tiptap/extension-table-header'
import TiptapTableRow from '@tiptap/extension-table-row'
import TiptapStarterKit from '@tiptap/starter-kit'
import { Markdown as TiptapMarkdown } from 'tiptap-markdown'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const TRACKPAD_DETECTION_THRESHOLD = 50

function addMarkdownWidget(
  node: LGraphNode,
  name: string,
  opts: { defaultVal: string }
) {
  TiptapMarkdown.configure({
    html: false,
    breaks: true,
    transformPastedText: true
  })
  const editor = new TiptapEditor({
    extensions: [
      TiptapStarterKit,
      TiptapMarkdown,
      TiptapLink,
      TiptapTable,
      TiptapTableCell,
      TiptapTableHeader,
      TiptapTableRow
    ],
    content: opts.defaultVal,
    editable: false
  })

  // Cache the settingStore once
  const settingStore = useSettingStore()

  const inputEl = editor.options.element as HTMLElement
  inputEl.classList.add('comfy-markdown')
  const textarea = document.createElement('textarea')
  inputEl.append(textarea)
  const editorDom: HTMLElement = editor.view.dom

  const widget = node.addDOMWidget(name, 'MARKDOWN', inputEl, {
    getValue(): string {
      return textarea.value
    },
    setValue(v: string) {
      textarea.value = v
      editor.commands.setContent(v)
    }
  })
  widget.inputEl = inputEl
  widget.options.minNodeSize = [400, 200]

  inputEl.addEventListener('dblclick', () => {
    inputEl.classList.add('editing')
    setTimeout(() => {
      textarea.focus()
    }, 0)
  })

  textarea.addEventListener('blur', () => {
    inputEl.classList.remove('editing')
  })

  textarea.addEventListener('change', () => {
    editor.commands.setContent(textarea.value)
    widget.callback?.(widget.value)
  })

  inputEl.addEventListener('keydown', (event: KeyboardEvent) => {
    event.stopPropagation()
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

  inputEl.addEventListener('wheel', (event: WheelEvent) => {
    // Use the cached settingStore
    const gesturesEnabled = settingStore.get(
      'LiteGraph.Pointer.TrackpadGestures'
    )
    const deltaX = event.deltaX
    const deltaY = event.deltaY

    const canScrollYMarkdown = editorDom.scrollHeight > editorDom.clientHeight
    const canScrollYTextarea = textarea.scrollHeight > textarea.clientHeight
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
    const isEditing = inputEl.classList.contains('editing')
    if (isEditing ? canScrollYTextarea : canScrollYMarkdown) {
      event.stopPropagation()
      return
    }

    // If textarea can't scroll vertically, pass to canvas
    event.preventDefault()
    app.canvas.processMouseWheel(event)
  })

  return widget
}

export const useMarkdownWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    return addMarkdownWidget(node, inputSpec.name, {
      defaultVal: inputSpec.default ?? ''
    })
  }

  return widgetConstructor
}
