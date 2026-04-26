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

import { memoize } from 'es-toolkit'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'
import { CREDITS_PER_USD, formatCredits } from '@/base/credits/comfyCredits'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  ComfyNodeDef,
  PriceBadge,
  WidgetDependency
} from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { Expression } from 'jsonata'
import jsonata from 'jsonata'

/**
 * Determine if a number should display 1 decimal place.
 * Shows decimal only when the first decimal digit is non-zero.
 */
const shouldShowDecimal = (value: number): boolean => {
  const rounded = Math.round(value * 10) / 10
  return rounded % 1 !== 0
}

const getNumberOptions = (credits: number): Intl.NumberFormatOptions => ({
  minimumFractionDigits: 0,
  maximumFractionDigits: shouldShowDecimal(credits) ? 1 : 0
})

type CreditFormatOptions = {
  suffix?: string
  note?: string
  approximate?: boolean
  separator?: string
}

export const formatCreditsValue = (usd: number): string => {
  // Use raw credits value (before rounding) to determine decimal display
  const rawCredits = usd * CREDITS_PER_USD
  return formatCredits({
    value: rawCredits,
    numberOptions: getNumberOptions(rawCredits)
  })
}

const makePrefix = (approximate?: boolean) => (approximate ? '~' : '')

const makeSuffix = (suffix?: string) => suffix ?? '/Run'

const appendNote = (note?: string) => (note ? ` ${note}` : '')

const formatCreditsLabel = (
  usd: number,
  { suffix, note, approximate }: CreditFormatOptions = {}
): string =>
  `${makePrefix(approximate)}${formatCreditsValue(usd)} credits${makeSuffix(suffix)}${appendNote(note)}`

export const formatCreditsRangeValue = (
  minUsd: number,
  maxUsd: number
): string => {
  const min = formatCreditsValue(minUsd)
  const max = formatCreditsValue(maxUsd)
  return min === max ? min : `${min}-${max}`
}

const formatCreditsRangeLabel = (
  minUsd: number,
  maxUsd: number,
  { suffix, note, approximate }: CreditFormatOptions = {}
): string => {
  const rangeValue = formatCreditsRangeValue(minUsd, maxUsd)
  return `${makePrefix(approximate)}${rangeValue} credits${makeSuffix(suffix)}${appendNote(note)}`
}

export const formatCreditsListValue = (
  usdValues: number[],
  separator = '/'
): string => {
  const parts = usdValues.map((value) => formatCreditsValue(value))
  return parts.join(separator)
}

const formatCreditsListLabel = (
  usdValues: number[],
  { suffix, note, approximate, separator }: CreditFormatOptions = {}
): string => {
  const value = formatCreditsListValue(usdValues, separator)
  return `${makePrefix(approximate)}${value} credits${makeSuffix(suffix)}${appendNote(note)}`
}

// -----------------------------
// JSONata pricing types
// -----------------------------
type PricingResult =
  | { type: 'text'; text: string }
  | { type: 'usd'; usd: number; format?: CreditFormatOptions }
  | {
      type: 'range_usd'
      min_usd: number
      max_usd: number
      format?: CreditFormatOptions
    }
  | { type: 'list_usd'; usd: number[]; format?: CreditFormatOptions }

const PRICING_RESULT_TYPES = ['text', 'usd', 'range_usd', 'list_usd'] as const

/** Type guard to validate that a value is a PricingResult. */
const isPricingResult = (value: unknown): value is PricingResult =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof (value as { type: unknown }).type === 'string' &&
  PRICING_RESULT_TYPES.includes(
    (value as { type: string }).type as (typeof PRICING_RESULT_TYPES)[number]
  )

/**
 * Widget values are normalized based on their declared type:
 * - INT/FLOAT → number (or null if not parseable)
 * - BOOLEAN → boolean (or null if not parseable)
 * - STRING/COMBO/other → string (lowercased, trimmed)
 */
type NormalizedWidgetValue = string | number | boolean | null

type JsonataPricingRule = {
  engine: 'jsonata'
  depends_on: {
    widgets: WidgetDependency[]
    inputs: string[]
    input_groups: string[]
  }
  expr: string
}

type CompiledJsonataPricingRule = JsonataPricingRule & {
  _compiled: Expression | null
}

/**
 * Shape of nodeData attached to LGraphNode constructor for API nodes.
 * Uses Pick from schema type to ensure consistency.
 */
type NodeConstructorData = Partial<
  Pick<ComfyNodeDef, 'name' | 'api_node' | 'price_badge'>
>

/**
 * Extract nodeData from an LGraphNode's constructor.
 * Centralizes the `as any` cast needed to access this runtime property.
 */
const getNodeConstructorData = (
  node: LGraphNode
): NodeConstructorData | undefined =>
  (node.constructor as { nodeData?: NodeConstructorData }).nodeData

/**
 * Predicate used by the pricing pipeline and by consumers that enumerate
 * api-nodes for display. Reads the same constructor-data path pricing uses
 * so enumeration and pricing never disagree on "what counts as an api-node" —
 * a custom-node registration that sets `nodeData.api_node` but bypasses the
 * node-def store is visible to both.
 */
export const isApiNode = (node: LGraphNode): boolean =>
  getNodeConstructorData(node)?.api_node === true

type JsonataEvalContext = {
  widgets: Record<string, NormalizedWidgetValue>
  inputs: Record<string, { connected: boolean }>
  /** Count of connected inputs per autogrow group */
  inputGroups: Record<string, number>
}

// -----------------------------
// Normalization helpers
// -----------------------------
const asFiniteNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null

  if (typeof v === 'number') return Number.isFinite(v) ? v : null

  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  // Do not coerce booleans/objects into numbers for pricing purposes.
  return null
}

/**
 * Normalize widget value based on its declared type.
 * Returns the value in its natural type for simpler JSONata expressions.
 */
const normalizeWidgetValue = (
  raw: unknown,
  declaredType: string
): NormalizedWidgetValue => {
  if (raw === undefined || raw === null) {
    return null
  }

  const upperType = declaredType.toUpperCase()

  // Numeric types
  if (upperType === 'INT' || upperType === 'FLOAT') {
    return asFiniteNumber(raw)
  }

  // Boolean type
  if (upperType === 'BOOLEAN') {
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'string') {
      const ls = raw.trim().toLowerCase()
      if (ls === 'true') return true
      if (ls === 'false') return false
    }
    return null
  }

  // COMBO type - preserve string/numeric values (for options like [5, "10"])
  if (upperType === 'COMBO') {
    if (typeof raw === 'number') return raw
    if (typeof raw === 'boolean') return raw
    return String(raw).trim().toLowerCase()
  }

  // String/other types - return as lowercase trimmed string
  return String(raw).trim().toLowerCase()
}

const buildJsonataContext = (
  node: LGraphNode,
  rule: JsonataPricingRule
): JsonataEvalContext => {
  const widgets: Record<string, NormalizedWidgetValue> = {}
  for (const dep of rule.depends_on.widgets) {
    const widget = node.widgets?.find((x: IBaseWidget) => x.name === dep.name)
    widgets[dep.name] = normalizeWidgetValue(widget?.value, dep.type)
  }

  const inputs: Record<string, { connected: boolean }> = {}
  for (const name of rule.depends_on.inputs) {
    const slot = node.inputs?.find((x: INodeInputSlot) => x.name === name)
    inputs[name] = { connected: slot?.link != null }
  }

  // Count connected inputs per autogrow group
  const inputGroups: Record<string, number> = {}
  for (const groupName of rule.depends_on.input_groups) {
    const prefix = groupName + '.'
    inputGroups[groupName] =
      node.inputs?.filter(
        (inp: INodeInputSlot) =>
          inp.name?.startsWith(prefix) && inp.link != null
      ).length ?? 0
  }

  return { widgets, inputs, inputGroups }
}

const safeValueForSig = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
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
// Result formatting
// -----------------------------

type FormatPricingResultOptions = {
  /** If true, return only the value without "credits/Run" suffix */
  valueOnly?: boolean
  defaults?: CreditFormatOptions
}

/**
 * Format a PricingResult into a display string.
 * @param result - The pricing result from JSONata evaluation
 * @param options - Formatting options
 * @returns Formatted string, e.g. "10 credits/Run" or "10" if valueOnly
 */
export const formatPricingResult = (
  result: unknown,
  options: FormatPricingResultOptions = {}
): string => {
  const { valueOnly = false, defaults = {} } = options

  // Handle legacy format: { usd: number } without type field
  if (
    result &&
    typeof result === 'object' &&
    !('type' in result) &&
    'usd' in result
  ) {
    const r = result as { usd: unknown }
    const usd = asFiniteNumber(r.usd)
    if (usd === null) return ''
    if (valueOnly) return formatCreditsValue(usd)
    return formatCreditsLabel(usd, defaults)
  }

  if (!isPricingResult(result)) {
    if (result !== undefined && result !== null) {
      console.warn('[pricing/jsonata] invalid result format:', result)
    }
    return ''
  }

  if (result.type === 'text') {
    return result.text ?? ''
  }

  if (result.type === 'usd') {
    const usd = asFiniteNumber(result.usd)
    if (usd === null) return ''
    const fmt = { ...defaults, ...(result.format ?? {}) }
    if (valueOnly) {
      const prefix = fmt.approximate ? '~' : ''
      return `${prefix}${formatCreditsValue(usd)}`
    }
    return formatCreditsLabel(usd, fmt)
  }

  if (result.type === 'range_usd') {
    const minUsd = asFiniteNumber(result.min_usd)
    const maxUsd = asFiniteNumber(result.max_usd)
    if (minUsd === null || maxUsd === null) return ''
    const fmt = { ...defaults, ...(result.format ?? {}) }
    if (valueOnly) {
      const prefix = fmt.approximate ? '~' : ''
      return `${prefix}${formatCreditsRangeValue(minUsd, maxUsd)}`
    }
    return formatCreditsRangeLabel(minUsd, maxUsd, fmt)
  }

  if (result.type === 'list_usd') {
    const arr = Array.isArray(result.usd) ? result.usd : null
    if (!arr) return ''

    const usdValues = arr
      .map(asFiniteNumber)
      .filter((x): x is number => x != null)

    if (usdValues.length === 0) return ''

    const fmt = { ...defaults, ...(result.format ?? {}) }
    if (valueOnly) {
      const prefix = fmt.approximate ? '~' : ''
      return `${prefix}${formatCreditsListValue(usdValues)}`
    }
    return formatCreditsListLabel(usdValues, fmt)
  }

  return ''
}

// -----------------------------
// Compile rules (non-fatal)
// -----------------------------
const compileRule = (rule: JsonataPricingRule): CompiledJsonataPricingRule => {
  try {
    return { ...rule, _compiled: jsonata(rule.expr) }
  } catch (e) {
    // Do not crash app on bad expressions; just disable rule.
    console.error('[pricing/jsonata] failed to compile expr:', rule.expr, e)
    return { ...rule, _compiled: null }
  }
}

// -----------------------------
// Rule cache (per-node-type)
// -----------------------------
// Cache compiled rules by node type name to avoid recompiling on every evaluation.
const compiledRulesCache = new Map<string, CompiledJsonataPricingRule | null>()

/**
 * Convert a PriceBadge from node definition to a JsonataPricingRule.
 */
const priceBadgeToRule = (priceBadge: PriceBadge): JsonataPricingRule => ({
  engine: priceBadge.engine ?? 'jsonata',
  depends_on: {
    widgets: priceBadge.depends_on?.widgets ?? [],
    inputs: priceBadge.depends_on?.inputs ?? [],
    input_groups: priceBadge.depends_on?.input_groups ?? []
  },
  expr: priceBadge.expr
})

/**
 * Get or compile a pricing rule for a node type.
 */
const getCompiledRuleForNodeType = (
  nodeName: string,
  priceBadge: PriceBadge | undefined
): CompiledJsonataPricingRule | null => {
  if (!priceBadge) return null

  // Check cache first
  if (compiledRulesCache.has(nodeName)) {
    return compiledRulesCache.get(nodeName) ?? null
  }

  // Compile and cache
  const rule = priceBadgeToRule(priceBadge)
  const compiled = compileRule(rule)
  compiledRulesCache.set(nodeName, compiled)
  return compiled
}

// -----------------------------
// Async evaluation + cache (JSONata 2.x)
// -----------------------------

// Reactive tick to force UI updates when async evaluations resolve.
// We purposely read pricingTick.value inside getNodeDisplayPrice to create
// a dependency. Bumped only in Nodes-1.0 mode so VueNodes keeps its
// fine-grained per-node re-render optimization — see `aggregateTick`
// below for the coarse signal that graph-wide consumers subscribe to.
const pricingTick = ref(0)

// Coarse "any node's async evaluation just completed" signal that fires in
// both modes. Consumed by graph-wide consumers (the cost aggregator, the
// row-list composable) that need to wake on every eval regardless of which
// node triggered it. Kept separate from pricingTick so bumping it doesn't
// invalidate every VueNodes badge computed on the page — that path still
// relies exclusively on per-node revision refs.
const aggregateTick = ref(0)

// Per-node revision tracking for VueNodes mode (more efficient than global tick)
// Uses plain Map with individual refs per node for fine-grained reactivity
// Keys are stringified node IDs to handle both string and number ID types
const nodeRevisions = new Map<string, Ref<number>>()

/**
 * Get or create a revision ref for a specific node.
 * Each node has its own independent ref, so updates to one won't trigger others.
 */
const getNodeRevisionRef = (nodeId: string | number): Ref<number> => {
  const key = String(nodeId)
  let rev = nodeRevisions.get(key)
  if (!rev) {
    rev = ref(0)
    nodeRevisions.set(key, rev)
  }
  return rev
}

type NumericPrice = { min: number; max: number }

// WeakMaps avoid memory leaks when nodes are removed.
type CacheEntry = {
  sig: string
  label: string
  values: NumericPrice | null
}
type InflightEntry = { sig: string; promise: Promise<void> }

/**
 * Extract raw numeric USD bounds from a pricing result.
 * Parallels {@link formatPricingResult} but preserves precision for aggregation.
 * Returns null for text-type, legacy or invalid shapes, or list_usd with no finite entries.
 *
 * `list_usd` folds to `{min: Math.min(values), max: Math.max(values)}`.
 * Alternative semantics (sum-of-list, product) are intentionally unhandled —
 * flagged as a reviewer question in the PR body.
 */
const extractNumericPrice = (result: unknown): NumericPrice | null => {
  if (result === null || typeof result !== 'object') return null

  // Legacy format: { usd: number } without type field.
  if (!('type' in result) && 'usd' in result) {
    const usd = asFiniteNumber((result as { usd: unknown }).usd)
    return usd === null ? null : { min: usd, max: usd }
  }

  if (!isPricingResult(result)) return null

  if (result.type === 'text') return null

  if (result.type === 'usd') {
    const usd = asFiniteNumber(result.usd)
    return usd === null ? null : { min: usd, max: usd }
  }

  if (result.type === 'range_usd') {
    const min = asFiniteNumber(result.min_usd)
    const max = asFiniteNumber(result.max_usd)
    if (min === null || max === null) return null
    // Clamp inverted bounds. JSONata can emit min_usd > max_usd from a
    // malformed rule (e.g. swapped fields, off-by-one branch). Letting
    // it propagate would render `~104.6-76.5` and feed an inverted
    // range into the aggregator's hasRange comparison.
    return { min: Math.min(min, max), max: Math.max(min, max) }
  }

  if (result.type === 'list_usd') {
    const arr = Array.isArray(result.usd) ? result.usd : null
    if (!arr) return null
    const values = arr
      .map(asFiniteNumber)
      .filter((x): x is number => x !== null)
    if (values.length === 0) return null
    // Fold as alternatives-pick-one: each entry is a price the node could
    // charge for a single run depending on user selection (e.g. quality
    // preset, model size). The aggregate bounds span the cheapest and
    // most expensive choice. This is NOT the right fold for nodes that
    // run all stages in sequence — those would need a summing fold — but
    // ComfyUI's api-node schema uses list_usd for mutually exclusive
    // options, not pipelines.
    return { min: Math.min(...values), max: Math.max(...values) }
  }

  return null
}

const cache = new WeakMap<LGraphNode, CacheEntry>()
const desiredSig = new WeakMap<LGraphNode, string>()
const inflight = new WeakMap<LGraphNode, InflightEntry>()

// Tracks the settle-promises of every in-flight evaluation so tests can
// await them deterministically instead of polling with a fixed timeout.
// Entries are removed in the scheduler's .finally(), so this stays bounded
// by the number of concurrently evaluating nodes and never holds a
// reference after the promise settles.
const pendingEvaluations = new Set<Promise<unknown>>()

/**
 * Test-only: await every in-flight pricing evaluation. Replaces the
 * ambient `setTimeout(50)` flush pattern that previously lived in
 * composable tests — those were a flake surface whenever the evaluator
 * took longer than 50ms on a busy CI worker, and silently over-waited
 * when evals resolved faster. Returns once every settling promise has
 * been removed from the tracking set.
 */
export const __testAwaitPendingEvaluations = async (): Promise<void> => {
  // Drain loop: reads the live set on every iteration so evaluations
  // scheduled by settling callbacks (cache write → tick bump → dependent
  // computed → new evaluation) are awaited in the same flush.
  while (pendingEvaluations.size > 0) {
    await Promise.allSettled([...pendingEvaluations])
  }
}

const scheduleEvaluation = (
  node: LGraphNode,
  rule: CompiledJsonataPricingRule,
  ctx: JsonataEvalContext,
  sig: string
) => {
  // Short-circuit on identical-signature in-flight before recording the
  // desired signature — the existing in-flight evaluation will satisfy
  // this request as-is, no state mutation needed.
  const running = inflight.get(node)
  if (running && running.sig === sig) return

  desiredSig.set(node, sig)

  const compiled = rule._compiled
  if (!compiled) return

  // Only bump the reactive ticks when the cache actually changed. Rapid
  // widget edits produce a stream of stale evaluations whose results are
  // discarded; bumping the aggregate tick on each of them would wake
  // useGraphCostAggregator and useApiNodeRows to recompute a total that
  // hasn't changed. Track a local flag and gate the bump on it.
  let didUpdate = false

  // Wrap the evaluate() invocation inside the promise chain so synchronous
  // throws (jsonata raises RangeError / ValueError on malformed data)
  // land in the .catch() below instead of crashing the Vue render that
  // triggered the read.
  const promise = Promise.resolve()
    .then(() => compiled.evaluate(ctx))
    .then((res) => {
      const label = formatPricingResult(res)
      const values = extractNumericPrice(res)

      // Ignore stale results: if the node changed while we were evaluating,
      // desiredSig will no longer match.
      if (desiredSig.get(node) !== sig) return

      cache.set(node, { sig, label, values })
      didUpdate = true
    })
    .catch(() => {
      // Cache empty to avoid retry-spam for same signature
      if (desiredSig.get(node) === sig) {
        cache.set(node, { sig, label: '', values: null })
        didUpdate = true
      }
    })
    .finally(() => {
      const cur = inflight.get(node)
      if (cur && cur.sig === sig) inflight.delete(node)
      pendingEvaluations.delete(promise)
      if (!didUpdate) return

      if (LiteGraph.vueNodesMode) {
        // VueNodes mode: bump per-node revision so only this node re-renders.
        getNodeRevisionRef(node.id).value++
      } else {
        // Nodes 1.0 mode: bump the global tick to trigger setDirtyCanvas.
        pricingTick.value++
      }
      // Coarse signal for graph-wide consumers (aggregator, row list). Fires
      // in both modes so they react to any eval completing, without the per-
      // node badges in VueNodes mode paying for a global invalidation.
      aggregateTick.value++
    })

  pendingEvaluations.add(promise)
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

  const nodeName = nodeData?.name ?? ''
  const priceBadge = nodeData?.price_badge

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
   * Shared sync lookup:
   * - validates the node has a usable pricing rule
   * - returns the fresh cache entry for the current signature, or
   *   the last-known (stale) entry while scheduling a refresh
   * - returns null when the node can never produce a price
   */
  const getNodePricingEntry = (node: LGraphNode): CacheEntry | null => {
    const nodeData = getNodeConstructorData(node)
    if (!nodeData?.api_node) return null

    const rule = getRuleForNode(node)
    if (!rule || rule.engine !== 'jsonata' || !rule._compiled) return null

    const ctx = buildJsonataContext(node, rule)
    const sig = buildSignature(ctx, rule)

    const cached = cache.get(node)
    if (cached && cached.sig === sig) return cached

    // Cache miss: start async evaluation.
    // Return last-known entry (if any) to avoid flicker; otherwise null.
    scheduleEvaluation(node, rule, ctx, sig)
    return cached ?? null
  }

  /**
   * Sync getter for display label: returns cached label or '' if not available.
   * Subscribes only to `pricingTick` (canvas-redraw signal) so per-node VueNodes
   * badge computeds do not invalidate on every graph-wide re-evaluation.
   */
  const getNodeDisplayPrice = (node: LGraphNode): string => {
    void pricingTick.value
    return getNodePricingEntry(node)?.label ?? ''
  }

  /**
   * Sync getter for display label that does NOT establish its own reactive
   * dependency. Use from graph-wide consumers (aggregator-adjacent row
   * lists) that already subscribe to `pricingAggregateRevision` — reading
   * `pricingTick` through {@link getNodeDisplayPrice} would double-
   * subscribe and couple graph-wide UI to the canvas-redraw signal, which
   * is dead in VueNodes mode and redundant with the aggregate tick in
   * Nodes-1.0 mode.
   */
  const getCachedDisplayLabel = (node: LGraphNode): string =>
    getNodePricingEntry(node)?.label ?? ''

  /**
   * Sync getter for raw numeric bounds: returns `{min, max}` USD or null.
   * Null is returned when the node is not an api-node, has no pricing rule,
   * evaluation has not yet produced a numeric result, or the result is text-only.
   * Use for aggregation; use {@link getNodeDisplayPrice} for UI label output.
   *
   * Subscribes only to `aggregateTick` — the graph-wide "any node re-evaluated"
   * signal that aggregator/row consumers want. Keeping this separate from
   * `pricingTick` is why per-node badges stay stable under graph-wide churn.
   */
  const getNodeNumericPrice = (node: LGraphNode): NumericPrice | null => {
    void aggregateTick.value
    return getNodePricingEntry(node)?.values ?? null
  }

  /**
   * Expose raw pricing config for tooling/debug UI.
   * (Strips compiled expression from returned object.)
   */
  const getNodePricingConfig = (node: LGraphNode) => {
    const rule = getRuleForNode(node)
    if (!rule) return undefined
    const { _compiled, ...config } = rule
    return config
  }

  /**
   * Caller compatibility helper:
   * returns union of widget dependencies + input dependencies for a node type.
   */
  const getRelevantWidgetNames = (nodeType: string): string[] => {
    const priceBadge = getNodePriceBadge(nodeType)
    if (!priceBadge) return []

    const dependsOn = priceBadge.depends_on ?? {
      widgets: [],
      inputs: [],
      input_groups: []
    }

    const widgetNames = (dependsOn.widgets ?? []).map((w) => w.name)

    // Dedupe while preserving order
    const out: string[] = []
    for (const n of [
      ...widgetNames,
      ...(dependsOn.inputs ?? []),
      ...(dependsOn.input_groups ?? [])
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
    if (!dependsOn) return false

    return (
      (dependsOn.widgets?.length ?? 0) > 0 ||
      (dependsOn.inputs?.length ?? 0) > 0 ||
      (dependsOn.input_groups?.length ?? 0) > 0
    )
  }

  /**
   * Get input_groups prefixes for a node type (for watching connection changes).
   */
  const getInputGroupPrefixes = (nodeType: string): string[] => {
    const priceBadge = getNodePriceBadge(nodeType)
    return priceBadge?.depends_on?.input_groups ?? []
  }

  /**
   * Get regular input names for a node type (for watching connection changes).
   */
  const getInputNames = (nodeType: string): string[] => {
    const priceBadge = getNodePriceBadge(nodeType)
    return priceBadge?.depends_on?.inputs ?? []
  }

  /**
   * Trigger price recalculation for a node (call when inputs change).
   * Forces re-evaluation by calling getNodeDisplayPrice which will detect
   * the signature change and schedule a new evaluation.
   */
  const triggerPriceRecalculation = (node: LGraphNode): void => {
    const nodeData = getNodeConstructorData(node)
    if (!nodeData?.api_node) return

    // Call getNodeDisplayPrice to trigger evaluation if signature changed
    getNodeDisplayPrice(node)
  }

  return {
    getNodeDisplayPrice,
    getCachedDisplayLabel,
    getNodeNumericPrice,
    getNodePricingConfig,
    getRelevantWidgetNames,
    hasDynamicPricing,
    getInputGroupPrefixes,
    getInputNames,
    getNodeRevisionRef, // Each node has its own independent ref, so updates to one won't trigger others
    triggerPriceRecalculation,
    pricingRevision: readonly(pricingTick), // canvas-redraw signal (Nodes-1.0 mode only)
    pricingAggregateRevision: readonly(aggregateTick) // graph-wide "any node re-evaluated" signal
  }
}

/**
 * Extract default value from an input spec.
 */
function extractDefaultFromSpec(spec: unknown[]): unknown {
  const specOptions = spec[1] as Record<string, unknown> | undefined

  // Check for explicit default
  if (specOptions && 'default' in specOptions) {
    return specOptions.default
  }
  // COMBO/DYNAMICCOMBO type with options array
  if (
    specOptions &&
    Array.isArray(specOptions.options) &&
    specOptions.options.length > 0
  ) {
    const firstOption = specOptions.options[0]
    // Dynamic combo: options are objects with 'key' property
    if (
      typeof firstOption === 'object' &&
      firstOption !== null &&
      'key' in firstOption
    ) {
      return (firstOption as { key: unknown }).key
    }
    // Standard combo: options are primitive values
    return firstOption
  }
  // COMBO type (old format): [["option1", "option2"], {...}]
  if (Array.isArray(spec[0]) && spec[0].length > 0) {
    return spec[0][0]
  }
  return null
}

/**
 * Evaluate pricing for a node definition using default widget values.
 * Used for NodePricingBadge where no LGraphNode instance exists.
 * Results are memoized by node name since they are deterministic.
 */
export const evaluateNodeDefPricing = memoize(
  async (nodeDef: ComfyNodeDef): Promise<string> => {
    const priceBadge = nodeDef.price_badge
    if (!priceBadge?.expr) return ''

    // Reuse compiled expression cache
    const rule = getCompiledRuleForNodeType(nodeDef.name, priceBadge)
    if (!rule?._compiled) return ''

    try {
      // Merge all inputs for lookup
      const allInputs = {
        ...(nodeDef.input?.required ?? {}),
        ...(nodeDef.input?.optional ?? {})
      }

      // Build widgets context using depends_on.widgets (matches buildJsonataContext)
      const widgets: Record<string, NormalizedWidgetValue> = {}
      for (const dep of priceBadge.depends_on?.widgets ?? []) {
        const spec = allInputs[dep.name]
        let rawValue: unknown = null
        if (Array.isArray(spec)) {
          rawValue = extractDefaultFromSpec(spec)
        } else if (dep.type.toUpperCase() === 'COMBO') {
          // For dynamic COMBO widgets without input spec, use a common default
          // that works with most pricing expressions (e.g., resolution selectors)
          rawValue = 'original'
        }
        widgets[dep.name] = normalizeWidgetValue(rawValue, dep.type)
      }

      // Build inputs context: assume all inputs are disconnected in preview
      const inputs: Record<string, { connected: boolean }> = {}
      for (const name of priceBadge.depends_on?.inputs ?? []) {
        inputs[name] = { connected: false }
      }

      // Build inputGroups context: assume 0 connected inputs in preview
      const inputGroups: Record<string, number> = {}
      for (const groupName of priceBadge.depends_on?.input_groups ?? []) {
        inputGroups[groupName] = 0
      }

      const context: JsonataEvalContext = { widgets, inputs, inputGroups }
      const result = await rule._compiled.evaluate(context)
      return formatPricingResult(result, { valueOnly: true })
    } catch (e) {
      console.error('[evaluateNodeDefPricing] error:', e)
      return ''
    }
  },
  { getCacheKey: (nodeDef: ComfyNodeDef) => nodeDef.name }
)
