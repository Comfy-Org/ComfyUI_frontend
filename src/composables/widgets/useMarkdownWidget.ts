import type { LGraphNode } from '@comfyorg/litegraph'
import { Editor as TiptapEditor } from '@tiptap/core'
import TiptapLink from '@tiptap/extension-link'
import TiptapTable from '@tiptap/extension-table'
import TiptapTableCell from '@tiptap/extension-table-cell'
import TiptapTableHeader from '@tiptap/extension-table-header'
import TiptapTableRow from '@tiptap/extension-table-row'
import TiptapStarterKit from '@tiptap/starter-kit'
import { Markdown as TiptapMarkdown } from 'tiptap-markdown'

import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import type { ComfyApp } from '@/types'
import type { InputSpec } from '@/types/apiTypes'

function addMarkdownWidget(
  node: LGraphNode,
  name: string,
  opts: { defaultVal: string },
  app: ComfyApp
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

  return { minWidth: 400, minHeight: 200, widget }
}

export const useMarkdownWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app: ComfyApp
  ) => {
    const defaultVal = inputData[1]?.default || ''
    return addMarkdownWidget(
      node,
      inputName,
      { defaultVal, ...inputData[1] },
      app
    )
  }

  return widgetConstructor
}
