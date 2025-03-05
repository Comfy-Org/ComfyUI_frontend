import type { LGraphNode } from '@comfyorg/litegraph'
import { Editor as TiptapEditor } from '@tiptap/core'
import TiptapLink from '@tiptap/extension-link'
import TiptapTable from '@tiptap/extension-table'
import TiptapTableCell from '@tiptap/extension-table-cell'
import TiptapTableHeader from '@tiptap/extension-table-header'
import TiptapTableRow from '@tiptap/extension-table-row'
import TiptapStarterKit from '@tiptap/starter-kit'
import { Markdown as TiptapMarkdown } from 'tiptap-markdown'

import { type InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import { type ComfyWidgetConstructorV2 } from '@/scripts/widgets'

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

  const inputEl = editor.options.element as HTMLElement
  inputEl.classList.add('comfy-markdown')
  const textarea = document.createElement('textarea')
  inputEl.append(textarea)

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

  inputEl.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0) {
      app.canvas.processMouseDown(event)
      return
    }
    if (event.target instanceof HTMLAnchorElement) {
      return
    }
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
