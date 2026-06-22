import type {
  INodeInputSlot,
  ISlotType,
  LLink
} from '@/lib/litegraph/src/litegraph'
import {
  LGraphNode,
  LiteGraph,
  resolveNodeRootGraphId
} from '@/lib/litegraph/src/litegraph'
import { resolvePromptTemplate } from '@/platform/prompts/promptResolution'
import type { PromptTemplate } from '@/platform/prompts/schemas/promptTypes'
import { app } from '@/scripts/app'
import { usePromptStore } from '@/stores/promptStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import { applyFirstWidgetValueToGraph } from './widgetValuePropagation'

const PROMPT_WIDGET_NAME = 'prompt'

function toTemplate(value: unknown): PromptTemplate {
  return Array.isArray(value) ? (value as PromptTemplate) : []
}

/** Reads a statically-known string value from a connected source node. */
function readStaticString(node: LGraphNode): string {
  const widget = node.widgets?.find((w) => typeof w.value === 'string')
  return typeof widget?.value === 'string' ? widget.value : ''
}

class PromptNode extends LGraphNode {
  static override category: string
  override isVirtualNode = true

  constructor(title?: string) {
    super(title ?? 'Prompt')

    this.addOutput('STRING', 'STRING')
    this.addInput('', 'STRING')
    this.serialize_widgets = true

    // Bridge the widget value through the widget value store, mirroring the
    // multiline string widget, so the Vue node renderer drives the editor.
    let fallback: PromptTemplate = []
    const state = () => {
      const graphId = resolveNodeRootGraphId(this, app.rootGraph?.id ?? '')
      if (!graphId) return undefined
      return useWidgetValueStore().getWidget(
        widgetId(graphId, this.id, PROMPT_WIDGET_NAME)
      )
    }

    this.addDOMWidget<HTMLElement, PromptTemplate>(
      PROMPT_WIDGET_NAME,
      'prompteditor',
      document.createElement('div'),
      {
        getValue: () => toTemplate(state()?.value ?? fallback),
        setValue: (value) => {
          fallback = toTemplate(value)
          const widgetState = state()
          if (widgetState) widgetState.value = fallback
        },
        getMinHeight: () => 180
      }
    )

    this.setSize([340, 280])
  }

  private getTemplate(): PromptTemplate {
    return toTemplate(
      this.widgets?.find((w) => w.name === PROMPT_WIDGET_NAME)?.value
    )
  }

  /** Resolves the editor template to its final string at submission time. */
  resolvePromptText(visited: ReadonlySet<string> = new Set()): string {
    const promptStore = usePromptStore()
    return resolvePromptTemplate(
      this.getTemplate(),
      {
        getPromptTemplate: (id) => promptStore.getPrompt(id)?.template,
        resolveVar: (name, currentVisited) =>
          this.resolveVar(name, currentVisited)
      },
      visited
    )
  }

  private resolveVar(name: string, visited: ReadonlySet<string>): string {
    const { graph } = this
    if (!graph) return ''

    for (const input of this.inputs ?? []) {
      if (input.link == null) continue
      const link = graph.links[input.link]
      const source = link ? graph.getNodeById(link.origin_id) : null
      if (source?.title?.trim() !== name) continue

      const key = `node:${source.id}`
      if (visited.has(key)) return ''
      const next = new Set(visited).add(key)
      return source instanceof PromptNode
        ? source.resolvePromptText(next)
        : readStaticString(source)
    }
    return ''
  }

  override applyToGraph(extraLinks: LLink[] = []) {
    const text = this.resolvePromptText()
    applyFirstWidgetValueToGraph(this, extraLinks, () => text)
  }

  override onConnectionsChange(
    type: ISlotType,
    _index: number | undefined,
    _connected: boolean
  ) {
    if (app.configuringGraph) return
    if (type !== LiteGraph.INPUT) return
    this.syncDynamicInputs()
  }

  override onAfterGraphConfigured() {
    this.syncDynamicInputs()
  }

  /**
   * Keeps the variable inputs in sync with connections: names newly connected
   * slots from their source node, drops disconnected ones, and keeps a single
   * empty trailing slot to receive the next connection.
   */
  private syncDynamicInputs() {
    const inputs = this.inputs ?? []

    for (let i = inputs.length - 1; i >= 0; i--) {
      const input = inputs[i]
      if (input.link == null && input.name) this.removeInput(i)
    }

    for (const input of this.inputs ?? []) {
      if (input.link != null && !input.name) {
        input.name = this.uniqueVarName(input)
      }
    }

    this.ensureTrailingPlaceholder()
  }

  private ensureTrailingPlaceholder() {
    for (let i = (this.inputs?.length ?? 0) - 1; i >= 0; i--) {
      const input = this.inputs![i]
      if (input.link == null && !input.name) this.removeInput(i)
    }
    this.addInput('', 'STRING')
  }

  private uniqueVarName(input: INodeInputSlot): string {
    const link = input.link != null ? this.graph?.links[input.link] : null
    const source = link ? this.graph?.getNodeById(link.origin_id) : null
    const base = source?.title?.trim() || 'var'

    const taken = new Set(
      (this.inputs ?? []).map((slot) => slot.name).filter(Boolean)
    )
    if (!taken.has(base)) return base

    let suffix = 2
    while (taken.has(`${base} ${suffix}`)) suffix++
    return `${base} ${suffix}`
  }
}

app.registerExtension({
  name: 'Comfy.PromptNode',
  registerCustomNodes() {
    LiteGraph.registerNodeType(
      'Prompt',
      Object.assign(PromptNode, { title: 'Prompt' })
    )
    PromptNode.category = 'utils'
  }
})
