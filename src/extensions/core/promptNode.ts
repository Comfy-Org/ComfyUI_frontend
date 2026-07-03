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
import type { PromptTemplate } from '@/platform/prompts/promptTypes'
import {
  planVariableSockets,
  renameVariableInTemplate
} from '@/platform/prompts/variableInputs'
import { app } from '@/scripts/app'
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
        getMinHeight: () => 140
      }
    )

    this.setSize([340, 240])
  }

  private getTemplate(): PromptTemplate {
    return toTemplate(
      this.widgets?.find((w) => w.name === PROMPT_WIDGET_NAME)?.value
    )
  }

  /** Resolves the editor template to its final string at submission time. */
  resolvePromptText(visited: ReadonlySet<string> = new Set()): string {
    return resolvePromptTemplate(
      this.getTemplate(),
      (name, currentVisited) => this.resolveVar(name, currentVisited),
      visited
    )
  }

  private resolveVar(name: string, visited: ReadonlySet<string>): string {
    const { graph } = this
    if (!graph) return ''

    const input = (this.inputs ?? []).find(
      (slot) => slot.name === name && slot.link != null
    )
    if (!input || input.link == null) return ''

    const link = graph.links[input.link]
    const source = link ? graph.getNodeById(link.origin_id) : null
    if (!source) return ''

    const key = `node:${source.id}`
    if (visited.has(key)) return ''
    const next = new Set(visited).add(key)
    return source instanceof PromptNode
      ? source.resolvePromptText(next)
      : readStaticString(source)
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
    this.reconcileVariableInputs(this.declaredVarNames())
  }

  override onAfterGraphConfigured() {
    this.reconcileVariableInputs(this.declaredVarNames())
  }

  /** Reconciles input sockets to the variables declared in the editor text. */
  syncVariableInputs(declared: readonly string[]) {
    this.reconcileVariableInputs(declared)
  }

  /**
   * Renames a variable input socket in place (preserving its link) and updates
   * every matching `@reference` in the editor text. No-ops on an empty name or a
   * collision with an existing socket.
   */
  renameVariableInput(oldName: string, newName: string) {
    const name = newName.trim()
    if (!name || name === oldName) return
    if ((this.inputs ?? []).some((slot) => slot.name === name)) return

    const input = (this.inputs ?? []).find((slot) => slot.name === oldName)
    if (!input) return
    input.name = name

    const widget = this.widgets?.find((w) => w.name === PROMPT_WIDGET_NAME)
    if (widget) {
      widget.value = renameVariableInTemplate(this.getTemplate(), oldName, name)
    }
  }

  private declaredVarNames(): string[] {
    const names: string[] = []
    for (const segment of this.getTemplate()) {
      if (segment.type === 'var' && !names.includes(segment.name)) {
        names.push(segment.name)
      }
    }
    return names
  }

  /**
   * Makes input sockets mirror the declared variables: one named socket per
   * variable, freshly connected sockets named after their source, and a single
   * trailing placeholder for ad-hoc wiring. Sockets that are neither declared
   * nor connected are dropped.
   */
  private reconcileVariableInputs(declared: readonly string[]) {
    for (const input of this.inputs ?? []) {
      if (input.link != null && !input.name) {
        input.name = this.uniqueVarName(input)
      }
    }

    const { namesToAdd, indicesToRemove } = planVariableSockets(
      (this.inputs ?? []).map((slot) => ({
        name: slot.name ?? '',
        connected: slot.link != null
      })),
      declared
    )

    for (const index of [...indicesToRemove].reverse()) this.removeInput(index)
    for (const name of namesToAdd) this.addInput(name, 'STRING')
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
