// JSONata-based pricing badge evaluation for API nodes.
//
// Pricing declarations are read from ComfyUI node definitions (price_badge field).
// The Frontend evaluates these declarations locally using a JSONata engine.
//
// JSONata v2.x NOTE:
// - jsonata(expression).evaluate(input) returns a Promise in JSONata 2.x.
// - Therefore, pricing evaluation is async. This file implements:
//   - sync getter (returns cached label / last-known label),
//   - async evaluation + cache,
//   - reactive tick to update UI when async evaluation completes.

import {
  formatPricingResult,
  getCompiledRuleForNodeType,
  normalizeWidgetValue
} from '@comfyorg/shared-frontend-utils/nodePricing'
import type {
  CompiledJsonataPricingRule,
  JsonataEvalContext,
  JsonataPricingRule,
  NormalizedWidgetValue
} from '@comfyorg/shared-frontend-utils/nodePricing'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { PriceBadge } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { NodeId } from '@/types/nodeId'

const getNodeConstructorData = (node: LGraphNode) => node.constructor.nodeData

const buildJsonataContext = (
  node: LGraphNode,
  rule: JsonataPricingRule,
  widgetOverrides?: ReadonlyMap<string, unknown>
): JsonataEvalContext => {
  const widgets: Record<string, NormalizedWidgetValue> = {}
  for (const dep of rule.depends_on.widgets) {
    const raw = widgetOverrides?.has(dep.name)
      ? widgetOverrides.get(dep.name)
      : node.widgets?.find((x: IBaseWidget) => x.name === dep.name)?.value
    widgets[dep.name] = normalizeWidgetValue(raw, dep.type)
  }

  const inputs: Record<string, { connected: boolean }> = {}
  for (const name of rule.depends_on.inputs) {
    const index = node.inputs.findIndex((x: INodeInputSlot) => x.name === name)
    inputs[name] = { connected: index !== -1 && node.isInputConnected(index) }
  }

  // Count connected inputs per autogrow group
  const inputGroups: Record<string, number> = {}
  for (const groupName of rule.depends_on.input_groups) {
    const prefix = groupName + '.'
    inputGroups[groupName] = node.inputs.filter(
      (inp: INodeInputSlot, index: number) =>
        inp.name.startsWith(prefix) && node.isInputConnected(index)
    ).length
  }

  return { widgets, inputs, inputGroups }
}

const safeValueForSig = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    return `${typeof v}:${String(v)}`
  try {
    return `json:${JSON.stringify(v)}`
  } catch {
    return `fallback:${String(v)}`
  }
}

// Signature determines whether we need to re-evaluate when widgets/inputs change.
const buildSignature = (
  ctx: JsonataEvalContext,
  rule: JsonataPricingRule
): string => {
  const parts: string[] = []
  for (const dep of rule.depends_on.widgets) {
    parts.push(`w:${dep.name}=${safeValueForSig(ctx.widgets[dep.name])}`)
  }
  for (const name of rule.depends_on.inputs) {
    parts.push(`i:${name}=${ctx.inputs[name]?.connected ? '1' : '0'}`)
  }
  for (const name of rule.depends_on.input_groups) {
    parts.push(`g:${name}=${ctx.inputGroups[name] ?? 0}`)
  }
  return parts.join('|')
}

// -----------------------------
// Async evaluation + cache (JSONata 2.x)
// -----------------------------

// Reactive tick to force UI updates when async evaluations resolve.
// We purposely read pricingTick.value inside getNodeDisplayPrice to create a dependency.
const pricingTick = ref(0)

// Per-node revision tracking for VueNodes mode (more efficient than global tick)
// Uses plain Map with individual refs per node for fine-grained reactivity
// Keys are stringified node IDs to handle both string and number ID types
const nodeRevisions = new Map<NodeId, Ref<number>>()

/**
 * Get or create a revision ref for a specific node.
 * Each node has its own independent ref, so updates to one won't trigger others.
 */
const getNodeRevisionRef = (nodeId: NodeId): Ref<number> => {
  let rev = nodeRevisions.get(nodeId)
  if (!rev) {
    rev = ref(0)
    nodeRevisions.set(nodeId, rev)
  }
  return rev
}

// WeakMaps avoid memory leaks when nodes are removed.
type InflightEntry = { sig: string; promise: Promise<void> }

const MAX_CACHED_SIGNATURES = 8
const cache = new WeakMap<LGraphNode, Map<string, string>>()
const inflight = new WeakMap<LGraphNode, InflightEntry>()

function nodeSigCache(node: LGraphNode): Map<string, string> {
  const existing = cache.get(node)
  if (existing) return existing
  const next = new Map<string, string>()
  cache.set(node, next)
  return next
}

function cacheLabel(node: LGraphNode, sig: string, label: string): void {
  const sigCache = nodeSigCache(node)
  sigCache.delete(sig)
  sigCache.set(sig, label)
  for (const oldest of sigCache.keys()) {
    if (sigCache.size <= MAX_CACHED_SIGNATURES) break
    sigCache.delete(oldest)
  }
}

const scheduleEvaluation = (
  node: LGraphNode,
  rule: CompiledJsonataPricingRule,
  ctx: JsonataEvalContext,
  sig: string
) => {
  const running = inflight.get(node)
  if (running && running.sig === sig) return

  if (!rule._compiled) return

  const promise = Promise.resolve(rule._compiled.evaluate(ctx))
    .then((res) => {
      cacheLabel(node, sig, formatPricingResult(res))
    })
    .catch(() => {
      // Cache empty to avoid retry-spam for same signature
      cacheLabel(node, sig, '')
    })
    .finally(() => {
      const cur = inflight.get(node)
      if (cur && cur.sig === sig) inflight.delete(node)

      if (LiteGraph.vueNodesMode) {
        // VueNodes mode: bump per-node revision (only this node re-renders)
        getNodeRevisionRef(node.id).value++
      }
      pricingTick.value++
    })

  inflight.set(node, { sig, promise })
}

/**
 * Get the pricing rule for a node from its nodeData.price_badge field.
 */
const getRuleForNode = (
  node: LGraphNode
): CompiledJsonataPricingRule | undefined => {
  const nodeData = getNodeConstructorData(node)
  if (!nodeData?.api_node) return undefined

  const nodeName = nodeData.name
  const priceBadge = nodeData.price_badge

  if (!priceBadge) return undefined

  const compiled = getCompiledRuleForNodeType(nodeName, priceBadge)
  return compiled ?? undefined
}

// -----------------------------
// Helper to get price badge from node type
// -----------------------------
const getNodePriceBadge = (nodeType: string): PriceBadge | undefined => {
  const nodeDefStore = useNodeDefStore()
  return nodeDefStore.nodeDefsByName[nodeType]?.price_badge
}

// -----------------------------
// Public composable API
// -----------------------------
export const useNodePricing = () => {
  /**
   * Sync getter:
   * - returns cached label for the current node signature when available
   * - schedules async evaluation when needed
   * - remains non-fatal on errors (returns safe fallback '')
   */
  const getNodeDisplayPrice = (
    node: LGraphNode,
    widgetOverrides?: ReadonlyMap<string, unknown>
  ): string => {
    // Make this function reactive: when async evaluation completes, we bump pricingTick,
    // which causes this getter to recompute in Vue render/computed contexts.
    void pricingTick.value

    const nodeData = getNodeConstructorData(node)
    if (!nodeData?.api_node) return ''

    const rule = getRuleForNode(node)
    if (!rule) return ''
    if (!rule._compiled) return ''

    const ctx = buildJsonataContext(node, rule, widgetOverrides)
    const sig = buildSignature(ctx, rule)

    const sigCache = cache.get(node)
    const hit = sigCache?.get(sig)
    if (hit !== undefined) return hit

    // Cache miss: start async evaluation.
    // Return the last-known label (if any) to avoid flicker.
    scheduleEvaluation(node, rule, ctx, sig)
    const labels = [...(sigCache?.values() ?? [])]
    return labels.at(-1) ?? ''
  }

  /**
   * Caller compatibility helper:
   * returns union of widget dependencies + input dependencies for a node type.
   */
  const getRelevantWidgetNames = (nodeType: string): string[] => {
    const priceBadge = getNodePriceBadge(nodeType)
    if (!priceBadge) return []

    const dependsOn = priceBadge.depends_on
    const widgetNames = dependsOn.widgets.map((w) => w.name)

    // Dedupe while preserving order
    const out: string[] = []
    for (const n of [
      ...widgetNames,
      ...dependsOn.inputs,
      ...dependsOn.input_groups
    ]) {
      if (!out.includes(n)) out.push(n)
    }
    return out
  }

  /**
   * Check if a node type has dynamic pricing (depends on widgets, inputs, or input_groups).
   */
  const hasDynamicPricing = (nodeType: string): boolean => {
    const priceBadge = getNodePriceBadge(nodeType)
    if (!priceBadge) return false

    const dependsOn = priceBadge.depends_on

    return (
      dependsOn.widgets.length > 0 ||
      dependsOn.inputs.length > 0 ||
      dependsOn.input_groups.length > 0
    )
  }

  /**
   * Get input_groups prefixes for a node type (for watching connection changes).
   */
  const getInputGroupPrefixes = (nodeType: string): string[] => {
    const priceBadge = getNodePriceBadge(nodeType)
    return priceBadge?.depends_on.input_groups ?? []
  }

  /**
   * Get regular input names for a node type (for watching connection changes).
   */
  const getInputNames = (nodeType: string): string[] => {
    const priceBadge = getNodePriceBadge(nodeType)
    return priceBadge?.depends_on.inputs ?? []
  }

  return {
    getNodeDisplayPrice,
    getRelevantWidgetNames,
    hasDynamicPricing,
    getInputGroupPrefixes,
    getInputNames,
    getNodeRevisionRef, // Each node has its own independent ref, so updates to one won't trigger others
    pricingRevision: readonly(pricingTick) // reactive invalidation signal
  }
}
