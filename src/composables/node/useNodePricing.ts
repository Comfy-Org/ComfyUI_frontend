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

import { ref, readonly } from 'vue'
import { formatCreditsFromUsd } from '@/base/credits/comfyCredits'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { PriceBadge } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import jsonata from 'jsonata'

const DEFAULT_NUMBER_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}

type CreditFormatOptions = {
  suffix?: string
  note?: string
  approximate?: boolean
  separator?: string
}

const formatCreditsValue = (usd: number): string =>
  formatCreditsFromUsd({
    usd,
    numberOptions: DEFAULT_NUMBER_OPTIONS
  })

const makePrefix = (approximate?: boolean) => (approximate ? '~' : '')

const makeSuffix = (suffix?: string) => suffix ?? '/Run'

const appendNote = (note?: string) => (note ? ` ${note}` : '')

const formatCreditsLabel = (
  usd: number,
  { suffix, note, approximate }: CreditFormatOptions = {}
): string =>
  `${makePrefix(approximate)}${formatCreditsValue(usd)} credits${makeSuffix(suffix)}${appendNote(note)}`

const formatCreditsRangeLabel = (
  minUsd: number,
  maxUsd: number,
  { suffix, note, approximate }: CreditFormatOptions = {}
): string => {
  const min = formatCreditsValue(minUsd)
  const max = formatCreditsValue(maxUsd)
  const rangeValue = min === max ? min : `${min}-${max}`
  return `${makePrefix(approximate)}${rangeValue} credits${makeSuffix(suffix)}${appendNote(note)}`
}

const formatCreditsListLabel = (
  usdValues: number[],
  { suffix, note, approximate, separator }: CreditFormatOptions = {}
): string => {
  const parts = usdValues.map((value) => formatCreditsValue(value))
  const value = parts.join(separator ?? '/')
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

type NormalizedWidgetValue = {
  raw: unknown
  s: string
  n: number | null
  b: boolean | null
}

type JsonataPricingRule = {
  engine: 'jsonata'
  depends_on: { widgets: string[]; inputs: string[]; input_groups: string[] }
  result_defaults?: CreditFormatOptions
  expr: string
}

type CompiledJsonataPricingRule = JsonataPricingRule & {
  _compiled: { evaluate: (input: unknown) => unknown } | null
}

type JsonataEvalContext = {
  w: Record<string, NormalizedWidgetValue>
  i: Record<string, { connected: boolean }>
  /** Count of connected inputs per autogrow group */
  g: Record<string, number>
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

const normalizeWidgetValue = (raw: unknown): NormalizedWidgetValue => {
  const s =
    raw === undefined || raw === null ? '' : String(raw).trim().toLowerCase()

  const n = asFiniteNumber(raw)

  let b: boolean | null = null
  if (typeof raw === 'boolean') {
    b = raw
  } else if (typeof raw === 'string') {
    const ls = raw.trim().toLowerCase()
    if (ls === 'true') b = true
    else if (ls === 'false') b = false
  }

  return { raw, s, n, b }
}

const buildJsonataContext = (
  node: LGraphNode,
  rule: JsonataPricingRule
): JsonataEvalContext => {
  const w: Record<string, NormalizedWidgetValue> = {}
  for (const name of rule.depends_on.widgets) {
    const widget = node.widgets?.find((x: any) => x?.name === name)
    w[name] = normalizeWidgetValue(widget?.value)
  }

  const i: Record<string, { connected: boolean }> = {}
  for (const name of rule.depends_on.inputs) {
    const slot = node.inputs?.find((x: any) => x?.name === name)
    i[name] = { connected: slot?.link != null }
  }

  // Count connected inputs per autogrow group
  const g: Record<string, number> = {}
  for (const groupName of rule.depends_on.input_groups) {
    const prefix = groupName + '.'
    const connectedCount =
      node.inputs?.filter(
        (inp: any) => inp?.name?.startsWith(prefix) && inp?.link != null
      ).length ?? 0
    g[groupName] = connectedCount
  }

  return { w, i, g }
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
  for (const name of rule.depends_on.widgets) {
    parts.push(`w:${name}=${safeValueForSig(ctx.w[name]?.raw)}`)
  }
  for (const name of rule.depends_on.inputs) {
    parts.push(`i:${name}=${ctx.i[name]?.connected ? '1' : '0'}`)
  }
  for (const name of rule.depends_on.input_groups) {
    parts.push(`g:${name}=${ctx.g[name] ?? 0}`)
  }
  return parts.join('|')
}

// -----------------------------
// Result formatting
// -----------------------------
const formatPricingResult = (
  result: unknown,
  defaults: CreditFormatOptions = {}
): string => {
  if (!result || typeof result !== 'object') return ''

  const r = result as Partial<PricingResult>

  if (r.type === 'text') {
    return (r as any).text ?? ''
  }

  if (r.type === 'usd') {
    const usd = asFiniteNumber((r as any).usd)
    if (usd === null) return ''
    const fmt = { ...defaults, ...((r as any).format ?? {}) }
    return formatCreditsLabel(usd, fmt)
  }

  if (r.type === 'range_usd') {
    const minUsd = asFiniteNumber((r as any).min_usd)
    const maxUsd = asFiniteNumber((r as any).max_usd)
    if (minUsd === null || maxUsd === null) return ''
    const fmt = { ...defaults, ...((r as any).format ?? {}) }
    return formatCreditsRangeLabel(minUsd, maxUsd, fmt)
  }

  if (r.type === 'list_usd') {
    const arr = Array.isArray((r as any).usd) ? (r as any).usd : null
    if (!arr) return ''

    const usdValues = arr
      .map(asFiniteNumber)
      .filter((x: any) => x != null) as number[]

    if (usdValues.length === 0) return ''

    const fmt = { ...defaults, ...((r as any).format ?? {}) }
    return formatCreditsListLabel(usdValues, fmt)
  }

  return ''
}

// -----------------------------
// Compile rules (non-fatal)
// -----------------------------
const compileRule = (rule: JsonataPricingRule): CompiledJsonataPricingRule => {
  try {
    return { ...rule, _compiled: jsonata(rule.expr) as any }
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
// We purposely read pricingTick.value inside getNodeDisplayPrice to create a dependency.
const pricingTick = ref(0)

// WeakMaps avoid memory leaks when nodes are removed.
type CacheEntry = { sig: string; label: string }
type InflightEntry = { sig: string; promise: Promise<void> }

const cache = new WeakMap<LGraphNode, CacheEntry>()
const desiredSig = new WeakMap<LGraphNode, string>()
const inflight = new WeakMap<LGraphNode, InflightEntry>()

const DEBUG_JSONATA_PRICING = false

const scheduleEvaluation = (
  node: LGraphNode,
  rule: CompiledJsonataPricingRule,
  ctx: JsonataEvalContext,
  sig: string
) => {
  desiredSig.set(node, sig)

  const running = inflight.get(node)
  if (running && running.sig === sig) return

  if (!rule._compiled) return

  const nodeName = (node.constructor as any)?.nodeData?.name ?? ''

  const promise = Promise.resolve(rule._compiled.evaluate(ctx as any))
    .then((res) => {
      const label = formatPricingResult(res, rule.result_defaults ?? {})

      // Ignore stale results: if the node changed while we were evaluating,
      // desiredSig will no longer match.
      if (desiredSig.get(node) !== sig) return

      cache.set(node, { sig, label })

      if (DEBUG_JSONATA_PRICING) {
        console.warn('[pricing/jsonata] resolved', nodeName, {
          sig,
          res,
          label
        })
      }
    })
    .catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[pricing/jsonata] evaluation failed', nodeName, err)
      }

      // Cache empty to avoid retry-spam for same signature
      if (desiredSig.get(node) === sig) {
        cache.set(node, { sig, label: '' })
      }
    })
    .finally(() => {
      const cur = inflight.get(node)
      if (cur && cur.sig === sig) inflight.delete(node)

      // Trigger reactive updates for any callers depending on pricingTick
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
  const nodeData = (node.constructor as any)?.nodeData as
    | { name?: string; api_node?: boolean; price_badge?: PriceBadge }
    | undefined

  if (!nodeData?.api_node) return undefined

  const nodeName = nodeData?.name ?? ''
  const priceBadge = nodeData?.price_badge

  if (!priceBadge) return undefined

  const compiled = getCompiledRuleForNodeType(nodeName, priceBadge)
  return compiled ?? undefined
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
  const getNodeDisplayPrice = (node: LGraphNode): string => {
    // Make this function reactive: when async evaluation completes, we bump pricingTick,
    // which causes this getter to recompute in Vue render/computed contexts.
    pricingTick.value

    const nodeData = (node.constructor as any)?.nodeData as
      | { name?: string; api_node?: boolean; price_badge?: PriceBadge }
      | undefined

    if (!nodeData?.api_node) return ''

    const rule = getRuleForNode(node)
    if (!rule) return ''
    if (rule.engine !== 'jsonata') return ''
    if (!rule._compiled) return ''

    const ctx = buildJsonataContext(node, rule)
    const sig = buildSignature(ctx, rule)

    const cached = cache.get(node)
    if (cached && cached.sig === sig) {
      return cached.label
    }

    // Cache miss: start async evaluation.
    // Return last-known label (if any) to avoid flicker; otherwise return empty.
    scheduleEvaluation(node, rule, ctx, sig)
    return cached?.label ?? ''
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
    const nodeDefStore = useNodeDefStore()
    const nodeDef = nodeDefStore.nodeDefsByName[nodeType]
    if (!nodeDef) return []

    const priceBadge = (nodeDef as any).price_badge as PriceBadge | undefined
    if (!priceBadge) return []

    const dependsOn = priceBadge.depends_on ?? { widgets: [], inputs: [] }

    // Keep stable output (dedupe while preserving order)
    const out: string[] = []
    for (const n of [
      ...(dependsOn.widgets ?? []),
      ...(dependsOn.inputs ?? [])
    ]) {
      if (!out.includes(n)) out.push(n)
    }
    return out
  }

  return {
    getNodeDisplayPrice,
    getNodePricingConfig,
    getRelevantWidgetNames,
    pricingRevision: readonly(pricingTick) // reactive invalidation signal
  }
}
