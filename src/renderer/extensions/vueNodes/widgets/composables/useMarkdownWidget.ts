import type { Editor as TiptapEditor } from '@tiptap/core'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/utils/widget'
import { reportError } from '@/platform/telemetry/reportError'
import { forwardMiddleButtonToCanvas } from '@/renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useApp } from '@/scripts/appInstance'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

function addMarkdownWidget(
  node: LGraphNode,
  name: string,
  opts: { defaultVal: string }
) {
  const widgetStore = useWidgetValueStore()

  const inputEl = document.createElement('div')
  inputEl.classList.add('comfy-markdown')
  const textarea = document.createElement('textarea')
  inputEl.append(textarea)
  let editor: TiptapEditor | undefined
  let markdown = opts.defaultVal
  function render(value: string) {
    markdown = value
    editor?.commands.setContent(value)
  }

  const widget = node.addDOMWidget(name, 'MARKDOWN', inputEl, {
    getValue(): string {
      const graphId = resolveNodeRootGraphId(node, useApp().rootGraph.id)
      const storedValue = widgetStore.getWidget(
        widgetId(graphId, node.id, name)
      )?.value
      return typeof storedValue === 'string' ? storedValue : textarea.value
    },
    setValue(v: string) {
      textarea.value = v
      render(v)
      const graphId = resolveNodeRootGraphId(node, useApp().rootGraph.id)
      const widgetState = widgetStore.getWidget(
        widgetId(graphId, node.id, name)
      )
      if (widgetState) widgetState.value = v
    }
  })
  widget.element = inputEl
  widget.options.minNodeSize = [400, 200]

  const controller = new AbortController()
  const { signal } = controller

  inputEl.addEventListener(
    'input',
    (event) => {
      if (event.target instanceof HTMLTextAreaElement) {
        widget.value = event.target.value
      }
      widget.callback?.(widget.value)
    },
    { signal }
  )

  inputEl.addEventListener(
    'dblclick',
    () => {
      inputEl.classList.add('editing')
      setTimeout(() => textarea.focus(), 0)
    },
    { signal }
  )

  textarea.addEventListener('blur', () => inputEl.classList.remove('editing'), {
    signal
  })

  textarea.addEventListener(
    'change',
    () => {
      render(textarea.value)
      widget.callback?.(widget.value)
    },
    { signal }
  )

  inputEl.addEventListener('keydown', (event) => event.stopPropagation(), {
    signal
  })

  forwardMiddleButtonToCanvas(inputEl, signal)

  widget.onRemove = useChainCallback(widget.onRemove, () => {
    controller.abort()
    if (editor && !editor.isDestroyed) editor.destroy()
  })

  void import('./markdownEditor')
    .then(({ createMarkdownEditor }) => {
      if (signal.aborted) return
      editor = createMarkdownEditor(inputEl, markdown)
    })
    .catch((error: unknown) =>
      reportError(error, {
        errorType: 'error_loading_markdown_editor',
        surface: 'platform'
      })
    )

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
