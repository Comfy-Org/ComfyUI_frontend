import type { Editor as TiptapEditor } from '@tiptap/core'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { forwardMiddleButtonToCanvas } from '@/renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

// TODO: This widget manually syncs with widgetValueStore via getValue/setValue.
// Consolidate with useStringWidget into shared helpers (domWidgetHelpers.ts).
function addMarkdownWidget(
  node: LGraphNode,
  name: string,
  opts: { defaultVal: string }
) {
  const widgetStore = useWidgetValueStore()

  // Build the shell synchronously so the widget is fully wired before Tiptap
  // loads. The Tiptap editor (~0.7MB) is imported lazily and mounted into this
  // element on arrival, keeping it off the app boot path.
  const inputEl = document.createElement('div')
  inputEl.classList.add('comfy-markdown')
  const textarea = document.createElement('textarea')
  textarea.value = opts.defaultVal
  inputEl.append(textarea)

  let editor: TiptapEditor | undefined
  let removed = false

  const widget = node.addDOMWidget(name, 'MARKDOWN', inputEl, {
    getValue(): string {
      const graphId = resolveNodeRootGraphId(node, app.rootGraph.id)
      const storedValue = widgetStore.getWidget(
        widgetId(graphId, node.id, name)
      )?.value
      return typeof storedValue === 'string' ? storedValue : textarea.value
    },
    setValue(v: string) {
      textarea.value = v
      editor?.commands.setContent(v)
      const graphId = resolveNodeRootGraphId(node, app.rootGraph.id)
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
      editor?.commands.setContent(textarea.value)
      widget.callback?.(widget.value)
    },
    { signal }
  )

  inputEl.addEventListener('keydown', (event) => event.stopPropagation(), {
    signal
  })

  forwardMiddleButtonToCanvas(inputEl, signal)

  // Attach the rich editor once its chunk resolves. A dynamic import can't be
  // cancelled, so a `removed` guard makes a late arrival a no-op after the node
  // is gone. On failure the shell textarea stays fully usable.
  void import('./markdownEditor')
    .then(({ createMarkdownEditor }) => {
      if (removed) return
      // Initialise from the current value, not the construction-time default,
      // so a setValue during the load window is reflected.
      editor = createMarkdownEditor(inputEl, textarea.value)
    })
    .catch((error) => {
      console.error('[markdownWidget] Failed to load editor', error)
    })

  widget.onRemove = useChainCallback(widget.onRemove, () => {
    removed = true
    controller.abort()
    if (editor && !editor.isDestroyed) editor.destroy()
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
