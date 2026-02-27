// Frontend eager evaluation for pure-computation nodes (e.g., math expression).
//
// Nodes declare `eager_eval` in their definition to opt in. The frontend
// evaluates a JSONata expression against the node's widget values whenever
// they change, displaying the result without a backend round-trip.
//
// Follows the same async-eval + cache pattern as useNodePricing.ts.

import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComfyNodeDef, EagerEval } from '@/schemas/nodeDefSchema'
import type { Expression } from 'jsonata'
import jsonata from 'jsonata'

// ---------------------
// Types
// ---------------------

type CompiledEagerEval = EagerEval & {
  _compiled: Expression | null
}

type NodeConstructorData = Partial<Pick<ComfyNodeDef, 'name' | 'eager_eval'>>

type EagerEvalContext = Record<string, number | null>

type CacheEntry = { sig: string; result: EagerEvalResult }
type InflightEntry = { sig: string; promise: Promise<void> }

export type EagerEvalResult = {
  value: unknown
  error?: string
}

// ---------------------
// Helpers
// ---------------------

const getNodeConstructorData = (
  node: LGraphNode
): NodeConstructorData | undefined =>
  (node.constructor as { nodeData?: NodeConstructorData }).nodeData

const asFiniteNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Retrieve the numeric output value from the node connected to the given link.
 * Returns undefined when the link/source node cannot be resolved or has no data yet.
 *
 * Checks output._data first (set by eager eval or backend execution), then
 * falls back to reading the source node's widget value for simple pass-through
 * nodes (e.g. INT, FLOAT) where output equals widget value.
 */
function getLinkedOutputValue(
  node: LGraphNode,
  linkId: number
): number | null | undefined {
  const link = node.graph?.getLink(linkId)
  if (!link) return undefined
  const sourceNode = node.graph?.getNodeById(link.origin_id)
  if (!sourceNode) return undefined
  const output = sourceNode.outputs?.[link.origin_slot]
  if (output?._data !== undefined) return asFiniteNumber(output._data)

  // Fallback: for single-output nodes (e.g. Int, Float primitives),
  // read the "value" widget directly. This enables eager eval without
  // requiring a backend round-trip.
  if (sourceNode.outputs?.length === 1 && sourceNode.widgets) {
    const valueWidget = sourceNode.widgets.find(
      (w: IBaseWidget) => w.name === 'value'
    )
    if (valueWidget) return asFiniteNumber(valueWidget.value)
  }
  return undefined
}

// ---------------------
// Compile cache
// ---------------------

const compiledCache = new Map<string, CompiledEagerEval | null>()

function compileEagerEval(config: EagerEval): CompiledEagerEval {
  const expr = config.expr
  if (!expr) return { ...config, _compiled: null }

  try {
    return { ...config, _compiled: jsonata(expr) }
  } catch (e) {
    console.error('[eager-eval] failed to compile expr:', expr, e)
    return { ...config, _compiled: null }
  }
}

function getCompiledForNodeType(
  nodeName: string,
  config: EagerEval
): CompiledEagerEval | null {
  const cacheKey = `${nodeName}:${config.expr ?? ''}`
  if (compiledCache.has(cacheKey)) return compiledCache.get(cacheKey) ?? null

  const compiled = compileEagerEval(config)
  compiledCache.set(cacheKey, compiled)
  return compiled
}

// ---------------------
// Context building
// ---------------------

/**
 * Build evaluation context from node widget values.
 * Maps input widgets to named variables: first input → "a", second → "b", etc.
 * Also includes original widget names for direct reference.
 */
export function buildEagerEvalContext(node: LGraphNode): EagerEvalContext {
  const ctx: EagerEvalContext = {}
  const values: (number | null)[] = []

  // Determine which widget holds the expression (should be excluded from context)
  const eagerConfig = getNodeConstructorData(node)?.eager_eval
  const exprWidgetName = eagerConfig?.expr_widget

  // Collect values from input slots, using widget values when disconnected
  // and connected node output data when connected.
  if (node.inputs) {
    for (const input of node.inputs) {
      if (input.name === exprWidgetName) continue

      let numVal: number | null
      if (input.link != null) {
        const linked = getLinkedOutputValue(node, input.link)
        if (linked === undefined) continue // connected but no data yet
        numVal = linked
      } else {
        const widget = node.widgets?.find(
          (w: IBaseWidget) => w.name === input.name
        )
        if (!widget) continue
        numVal = asFiniteNumber(widget.value)
      }

      ctx[input.name] = numVal
      values.push(numVal)

      // Autogrow inputs are named "group.baseName" (e.g. "values.value0").
      // Also expose the baseName alone so expressions can use "value0" directly,
      // matching the context the backend builds from autogrow dict keys.
      if (input.name.includes('.')) {
        const baseName = input.name.slice(input.name.indexOf('.') + 1)
        if (baseName && !(baseName in ctx)) ctx[baseName] = numVal
      }
    }
  }

  // Also collect from standalone widgets (not tied to inputs)
  if (node.widgets) {
    for (const widget of node.widgets) {
      if (widget.name in ctx) continue
      if (widget.name === exprWidgetName) continue
      const isInputWidget = node.inputs?.some((inp) => inp.name === widget.name)
      if (isInputWidget) continue
      ctx[widget.name] = asFiniteNumber(widget.value)
    }
  }

  // Map positional variables: a, b, c, ...
  // Only assign if the letter doesn't already exist as a named input
  let letterIdx = 0
  if (node.inputs) {
    for (const input of node.inputs) {
      if (input.name === exprWidgetName) continue
      if (!(input.name in ctx)) continue
      const letter = String.fromCharCode(97 + letterIdx) // a, b, c...
      if (!(letter in ctx)) {
        ctx[letter] = ctx[input.name]
      }
      letterIdx++
    }
  }

  // Add values array for aggregate functions ($sum, $max, etc.)
  const numericValues = values.filter((v): v is number => v !== null)
  if (numericValues.length > 0) {
    ;(ctx as Record<string, unknown>)['values'] = numericValues
  }

  return ctx
}

function buildSignature(ctx: EagerEvalContext, expr: string): string {
  const parts: string[] = [`e:${expr}`]
  for (const [key, val] of Object.entries(ctx)) {
    parts.push(`${key}=${val === null ? '' : String(val)}`)
  }
  return parts.join('|')
}

// ---------------------
// Async eval + cache
// ---------------------

const evalTick = ref(0)

const nodeRevisions = new WeakMap<LGraphNode, Ref<number>>()

function getNodeRevisionRef(node: LGraphNode): Ref<number> {
  let rev = nodeRevisions.get(node)
  if (!rev) {
    rev = ref(0)
    nodeRevisions.set(node, rev)
  }
  return rev
}

const cache = new WeakMap<LGraphNode, CacheEntry>()
const desiredSig = new WeakMap<LGraphNode, string>()
const inflight = new WeakMap<LGraphNode, InflightEntry>()

function scheduleEvaluation(
  node: LGraphNode,
  compiled: Expression,
  ctx: EagerEvalContext,
  sig: string
) {
  desiredSig.set(node, sig)

  const running = inflight.get(node)
  if (running && running.sig === sig) return

  const promise = Promise.resolve(compiled.evaluate(ctx))
    .then((res) => {
      if (desiredSig.get(node) !== sig) return
      cache.set(node, { sig, result: { value: res } })
      // Write result to output._data so downstream nodes (and input label
      // display) can read it without requiring a backend round-trip.
      if (node.outputs?.[0]) node.outputs[0]._data = res
    })
    .catch((err: unknown) => {
      if (desiredSig.get(node) === sig) {
        const message = err instanceof Error ? err.message : 'Evaluation error'
        cache.set(node, { sig, result: { value: null, error: message } })
      }
    })
    .finally(() => {
      const cur = inflight.get(node)
      if (cur && cur.sig === sig) inflight.delete(node)

      // Only bump revision if this eval is still the desired one
      if (desiredSig.get(node) === sig) {
        if (LiteGraph.vueNodesMode) {
          getNodeRevisionRef(node).value++
        } else {
          evalTick.value++
        }
      }
    })

  inflight.set(node, { sig, promise })
}

// ---------------------
// Expression resolution
// ---------------------

/**
 * Resolve the JSONata expression for a node.
 * If `expr_widget` is set, reads the expression from the widget value.
 * If `expr` is set, uses the static expression.
 */
function resolveExpression(node: LGraphNode, config: EagerEval): string | null {
  if (config.expr_widget) {
    const widget = node.widgets?.find(
      (w: IBaseWidget) => w.name === config.expr_widget
    )
    return widget ? String(widget.value ?? '') : null
  }
  return config.expr ?? null
}

// ---------------------
// Public composable
// ---------------------

export function useNodeEagerEval() {
  /**
   * Get the eager evaluation result for a node.
   * Returns cached result synchronously; schedules async evaluation on cache miss.
   */
  function getNodeEagerResult(node: LGraphNode): EagerEvalResult | null {
    void evalTick.value

    const nodeData = getNodeConstructorData(node)
    if (!nodeData?.eager_eval) return null

    const config = nodeData.eager_eval
    const expr = resolveExpression(node, config)
    if (!expr) return null

    // Build context and check cache before compiling
    const ctx = buildEagerEvalContext(node)
    const sig = buildSignature(ctx, expr)

    const cached = cache.get(node)
    if (cached && cached.sig === sig) return cached.result

    // Compile expression only on cache miss
    let compiled: Expression | null = null
    if (config.expr_widget) {
      try {
        compiled = jsonata(expr)
      } catch {
        return { value: null, error: 'Invalid expression' }
      }
    } else {
      const cachedCompiled = getCompiledForNodeType(nodeData.name ?? '', config)
      compiled = cachedCompiled?._compiled ?? null
    }
    if (!compiled) return null

    scheduleEvaluation(node, compiled, ctx, sig)
    return null
  }

  /**
   * Format an eager eval result for display as a badge.
   */
  function formatEagerResult(result: EagerEvalResult): string {
    if (result.error) return result.error
    if (result.value === null || result.value === undefined) return ''
    if (typeof result.value === 'number') {
      return Number.isInteger(result.value)
        ? String(result.value)
        : result.value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    }
    return String(result.value)
  }

  /**
   * Check if a node supports eager evaluation.
   */
  function hasEagerEval(node: LGraphNode): boolean {
    return !!getNodeConstructorData(node)?.eager_eval
  }

  /**
   * Trigger re-evaluation for a node (call when inputs/widgets change).
   */
  function triggerEagerEval(node: LGraphNode): void {
    getNodeEagerResult(node)
  }

  return {
    getNodeEagerResult,
    formatEagerResult,
    hasEagerEval,
    triggerEagerEval,
    getNodeRevisionRef,
    evalRevision: readonly(evalTick)
  }
}
