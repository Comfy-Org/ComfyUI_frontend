import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import type { SYNTH_PRODUCERS } from '@e2e/fixtures/customNode/autoRun'
import type {
  LogicalShape,
  NodeInteractionProfile
} from '@e2e/fixtures/customNode/interactionProfiles'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import { normalizeNodeDefs } from '@e2e/fixtures/customNode/typePairing'

export const INTERACTION_PROBE_CHUNK = 40

interface InteractionProbeEndpoint {
  inputName: string
}

export interface InteractionProbePlan {
  type: string
  first?: InteractionProbeEndpoint
  last?: InteractionProbeEndpoint
}

export interface InteractionProbeChunkResult {
  created: string[]
  results: Record<string, NodeInteractionProfile>
  threw: Record<string, string>
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
      if (firstInput) plan.first = { inputName: firstInput.name }
      if (lastInput && lastInput !== firstInput)
        plan.last = { inputName: lastInput.name }
      return plan
    })
    .sort((a, b) => a.type.localeCompare(b.type))
}

export async function runInteractionProbeChunk(input: {
  probePlans: InteractionProbePlan[]
  producers: typeof SYNTH_PRODUCERS
}): Promise<InteractionProbeChunkResult> {
  const { probePlans, producers } = input
  const shapeOf = (node: LGraphNode): LogicalShape => ({
    inputs: (node.inputs ?? []).map(
      (slot) => `input:${slot.name}:${String(slot.type)}`
    ),
    outputs: (node.outputs ?? []).map(
      (slot) => `output:${slot.name}:${String(slot.type)}`
    ),
    widgets: (node.widgets ?? [])
      .filter((widget) => widget.name !== '$$canvas-image-preview')
      .map((widget) => `widget:${widget.name ?? '?'}:${widget.type ?? '?'}`)
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
  const shapesEqual = (left: LogicalShape, right: LogicalShape) =>
    JSON.stringify(left) === JSON.stringify(right)
  const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
  const stableShapeOf = async (node: LGraphNode): Promise<LogicalShape> => {
    let previous = shapeOf(node)
    let stableSamples = 0
    for (let attempt = 0; attempt < 50; attempt++) {
      await nextTask()
      const current = shapeOf(node)
      if (shapesEqual(previous, current)) {
        stableSamples++
        if (stableSamples === 2) return current
      } else {
        previous = current
        stableSamples = 0
      }
    }
    throw new Error('node topology did not stabilize after 50 event-loop turns')
  }
  const settleRemoval = async () => {
    await nextTask()
    await nextTask()
  }
  const graph = window.app!.graph
  window.__cnIdBase = Math.max(window.__cnIdBase ?? 0, graph.last_node_id)
  const created: string[] = []
  const results: Record<string, NodeInteractionProfile> = {}
  const threw: Record<string, string> = {}
  for (const plan of probePlans) {
    const node = window.LiteGraph!.createNode(plan.type)
    if (!node) {
      threw[plan.type] = `${plan.type} did not instantiate`
      continue
    }
    created.push(plan.type)
    try {
      graph.last_node_id = ++window.__cnIdBase!
      graph.add(node)
      await stableShapeOf(node)
      const probeConnect = async (
        targetNode: LGraphNode,
        spec: InteractionProbeEndpoint
      ) => {
        const fresh = await stableShapeOf(targetNode)
        const inputIndex = (targetNode.inputs ?? []).findIndex(
          (slot) => slot.name === spec.inputName
        )
        if (inputIndex === -1) return null
        const inputType = String(targetNode.inputs[inputIndex].type)
        const direct = producers[inputType]
        const candidates = direct
          ? [direct]
          : Object.entries(producers).flatMap(([outputType, producer]) =>
              outputType !== '*' &&
              window.LiteGraph!.isValidConnection(outputType, inputType)
                ? [producer]
                : []
            )
        const producer = candidates[0]
        if (!producer) return null
        const producerNode = window.LiteGraph!.createNode(producer.nodeType)
        if (!producerNode)
          throw new Error(`${producer.nodeType} did not instantiate`)
        try {
          graph.last_node_id = ++window.__cnIdBase!
          graph.add(producerNode)
          const link = producerNode.connect(
            producer.outputIndex,
            targetNode,
            inputIndex
          )
          if (!link)
            throw new Error(
              `${producer.nodeType}[${producer.outputIndex}] could not connect to ${plan.type}.${spec.inputName}`
            )
          const connected = await stableShapeOf(targetNode)
          targetNode.disconnectInput(inputIndex)
          const disconnected = await stableShapeOf(targetNode)
          return { fresh, connected, disconnected }
        } finally {
          if (producerNode.graph) graph.remove(producerNode)
          await settleRemoval()
        }
      }
      if ((node.inputs ?? []).length === 0) {
        results[plan.type] = {
          connectFirst: 'NO_INPUTS',
          connectLast: 'NO_INPUTS',
          disconnect: 'NO_INPUTS'
        }
      } else {
        const first = plan.first ? await probeConnect(node, plan.first) : null
        if (plan.last && node.graph) {
          graph.remove(node)
          await settleRemoval()
        }
        const lastSpec = plan.last
        const last = lastSpec
          ? await (async () => {
              const lastNode = window.LiteGraph!.createNode(plan.type)
              if (!lastNode)
                throw new Error(`${plan.type} did not instantiate for last`)
              try {
                graph.last_node_id = ++window.__cnIdBase!
                graph.add(lastNode)
                await stableShapeOf(lastNode)
                return await probeConnect(lastNode, lastSpec)
              } finally {
                if (lastNode.graph) graph.remove(lastNode)
                await settleRemoval()
              }
            })()
          : null
        const anchor = last ?? first
        results[plan.type] = {
          connectFirst: first
            ? diff(first.fresh, first.connected)
            : 'NO_PRODUCER',
          connectLast: plan.last
            ? last
              ? diff(last.fresh, last.connected)
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
      await settleRemoval()
    }
  }
  return { created, results, threw }
}
