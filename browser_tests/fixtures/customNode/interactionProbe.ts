import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { SYNTH_PRODUCERS } from '@e2e/fixtures/customNode/autoRun'
import type {
  LogicalShape,
  NodeInteractionProfile
} from '@e2e/fixtures/customNode/interactionProfiles'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import {
  isTypeCompatible,
  normalizeNodeDefs
} from '@e2e/fixtures/customNode/typePairing'

export const INTERACTION_PROBE_CHUNK = 40

export interface InteractionProbePlan {
  type: string
  first?: { inputName: string; producer: string; producerOutput: number }
  last?: { inputName: string; producer: string; producerOutput: number }
}

export interface InteractionProbeChunkResult {
  results: Record<string, NodeInteractionProfile>
  threw: Record<string, string>
}

function producerFor(
  inputType: string
): { producer: string; producerOutput: number } | null {
  const direct = SYNTH_PRODUCERS[inputType]
  if (direct)
    return { producer: direct.nodeType, producerOutput: direct.outputIndex }
  for (const [outType, synth] of Object.entries(SYNTH_PRODUCERS))
    if (outType !== '*' && isTypeCompatible(outType, inputType))
      return { producer: synth.nodeType, producerOutput: synth.outputIndex }
  return null
}

export function planInteractionProbes(
  defs: Record<string, RawNodeDef>,
  pack: string
): InteractionProbePlan[] {
  return normalizeNodeDefs(defs)
    .filter((node) => node.pack === pack)
    .map((node) => {
      const plan: InteractionProbePlan = { type: node.type }
      const firstInput = node.inputs[0]
      const lastInput = node.inputs[node.inputs.length - 1]
      if (firstInput) {
        const producer = producerFor(firstInput.type)
        if (producer) plan.first = { inputName: firstInput.name, ...producer }
      }
      if (lastInput && lastInput !== firstInput) {
        const producer = producerFor(lastInput.type)
        if (producer) plan.last = { inputName: lastInput.name, ...producer }
      }
      return plan
    })
    .sort((a, b) => a.type.localeCompare(b.type))
}

export function runInteractionProbeChunk(
  probePlans: InteractionProbePlan[]
): InteractionProbeChunkResult {
  const shapeOf = (node: LGraphNode): LogicalShape => ({
    inputs: (node.inputs ?? []).map(
      (slot) => `input:${slot.name}:${String(slot.type)}`
    ),
    outputs: (node.outputs ?? []).map(
      (slot) => `output:${slot.name}:${String(slot.type)}`
    ),
    widgets: (node.widgets ?? []).map(
      (widget) => `widget:${widget.name ?? '?'}:${widget.type ?? '?'}`
    )
  })
  const diff = (before: LogicalShape, after: LogicalShape): string[] => {
    const delta: string[] = []
    for (const facet of ['inputs', 'outputs', 'widgets'] as const) {
      const beforeSet = new Set(before[facet])
      const afterSet = new Set(after[facet])
      for (const item of afterSet)
        if (!beforeSet.has(item)) delta.push(`+${item}`)
      for (const item of beforeSet)
        if (!afterSet.has(item)) delta.push(`-${item}`)
    }
    return delta.sort()
  }
  const graph = window.app!.graph
  window.__cnIdBase = Math.max(window.__cnIdBase ?? 0, graph.last_node_id)
  const results: Record<string, NodeInteractionProfile> = {}
  const threw: Record<string, string> = {}
  for (const plan of probePlans) {
    const node = window.LiteGraph!.createNode(plan.type)
    if (!node) continue
    try {
      graph.last_node_id = ++window.__cnIdBase!
      graph.add(node)
      const fresh = shapeOf(node)
      const probeConnect = (spec: {
        inputName: string
        producer: string
        producerOutput: number
      }) => {
        const producerNode = window.LiteGraph!.createNode(spec.producer)
        if (!producerNode) return null
        try {
          graph.last_node_id = ++window.__cnIdBase!
          graph.add(producerNode)
          const inputIndex = (node.inputs ?? []).findIndex(
            (slot) => slot.name === spec.inputName
          )
          if (inputIndex === -1) return null
          const link = producerNode.connect(
            spec.producerOutput,
            node,
            inputIndex
          )
          if (!link)
            throw new Error(
              `${spec.producer}[${spec.producerOutput}] could not connect to ${plan.type}.${spec.inputName}`
            )
          const connected = shapeOf(node)
          node.disconnectInput(inputIndex)
          return { connected, disconnected: shapeOf(node) }
        } finally {
          if (producerNode.graph) graph.remove(producerNode)
        }
      }
      if ((node.inputs ?? []).length === 0) {
        results[plan.type] = {
          connectFirst: 'NO_INPUTS',
          connectLast: 'NO_INPUTS',
          disconnect: 'NO_INPUTS'
        }
      } else {
        const first = plan.first ? probeConnect(plan.first) : null
        const last = plan.last ? probeConnect(plan.last) : null
        const anchor = last ?? first
        results[plan.type] = {
          connectFirst: first ? diff(fresh, first.connected) : 'NO_PRODUCER',
          connectLast: plan.last
            ? last
              ? diff(fresh, last.connected)
              : 'NO_PRODUCER'
            : 'SAME_AS_FIRST',
          disconnect: anchor
            ? diff(anchor.connected, anchor.disconnected)
            : 'NO_PRODUCER'
        }
      }
    } catch (error) {
      threw[plan.type] = String(error)
    } finally {
      if (node.graph) graph.remove(node)
    }
  }
  return { results, threw }
}
