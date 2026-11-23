import type {
  ComfyNodeDef,
  PriceBadge,
  WidgetDependency
} from '@comfyorg/object-info-parser'
import { memoize } from 'es-toolkit'
import type { Expression } from 'jsonata'
import jsonata from 'jsonata'

import { CREDITS_PER_USD, formatCredits } from './creditsUtil'

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

/** Type guard to validate that a value is a PricingResult. */
const isPricingResult = (value: unknown): value is PricingResult => {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false
  }

  switch (value.type) {
    case 'text':
      return 'text' in value && typeof value.text === 'string'
    case 'usd':
      return 'usd' in value && typeof value.usd === 'number'
    case 'range_usd':
      return (
        'min_usd' in value &&
        typeof value.min_usd === 'number' &&
        'max_usd' in value &&
        typeof value.max_usd === 'number'
      )
    case 'list_usd':
      return (
        'usd' in value &&
        Array.isArray(value.usd) &&
        value.usd.every((usd) => typeof usd === 'number')
      )
    default:
      return false
  }
}

/**
 * Widget values are normalized based on their declared type:
 * - INT/FLOAT → number (or null if not parseable)
 * - BOOLEAN → boolean (or null if not parseable)
 * - STRING/COMBO/other → string (lowercased, trimmed)
 */
export type NormalizedWidgetValue = string | number | boolean | null

export type JsonataPricingRule = {
  engine: 'jsonata'
  depends_on: {
    widgets: WidgetDependency[]
    inputs: string[]
    input_groups: string[]
  }
  expr: string
}

export type CompiledJsonataPricingRule = JsonataPricingRule & {
  _compiled: Expression | null
}

export type JsonataEvalContext = {
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
export const normalizeWidgetValue = (
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
    const usd = asFiniteNumber(result.usd)
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
    return result.text
  }

  if (result.type === 'usd') {
    const usd = asFiniteNumber(result.usd)
    if (usd === null) return ''
    const fmt = { ...defaults, ...result.format }
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
    const fmt = { ...defaults, ...result.format }
    if (valueOnly) {
      const prefix = fmt.approximate ? '~' : ''
      return `${prefix}${formatCreditsRangeValue(minUsd, maxUsd)}`
    }
    return formatCreditsRangeLabel(minUsd, maxUsd, fmt)
  }

  {
    const usdValues = result.usd
      .map(asFiniteNumber)
      .filter((x): x is number => x != null)

    if (usdValues.length === 0) return ''

    const fmt = { ...defaults, ...result.format }
    if (valueOnly) {
      const prefix = fmt.approximate ? '~' : ''
      return `${prefix}${formatCreditsListValue(usdValues, fmt.separator)}`
    }
    return formatCreditsListLabel(usdValues, fmt)
  }
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
const compiledRulesCache = new Map<
  string,
  { signature: string; rule: CompiledJsonataPricingRule }
>()

/**
 * Convert a PriceBadge from node definition to a JsonataPricingRule.
 */
const priceBadgeToRule = (priceBadge: PriceBadge): JsonataPricingRule => ({
  engine: priceBadge.engine,
  depends_on: priceBadge.depends_on,
  expr: priceBadge.expr
})

/**
 * Get or compile a pricing rule for a node type.
 */
export const getCompiledRuleForNodeType = (
  nodeName: string,
  priceBadge: PriceBadge | undefined
): CompiledJsonataPricingRule | null => {
  if (!priceBadge) return null

  const rule = priceBadgeToRule(priceBadge)
  const signature = JSON.stringify(rule)
  const cached = compiledRulesCache.get(nodeName)
  if (cached?.signature === signature) return cached.rule

  const compiled = compileRule(rule)
  compiledRulesCache.set(nodeName, { signature, rule: compiled })
  return compiled
}

export async function evaluatePricingContext(
  name: string,
  badge: PriceBadge,
  context: JsonataEvalContext,
  options: FormatPricingResultOptions = {}
): Promise<string> {
  const rule = getCompiledRuleForNodeType(name, badge)
  if (!rule?._compiled) return ''
  try {
    const result: unknown = await rule._compiled.evaluate(context)
    return formatPricingResult(result, options)
  } catch {
    return ''
  }
}

/**
 * Extract default value from an input spec.
 */
function extractDefaultFromSpec(spec: unknown[]): unknown {
  const specOptions = spec[1]

  // Check for explicit default
  if (
    typeof specOptions === 'object' &&
    specOptions &&
    'default' in specOptions
  ) {
    return specOptions.default
  }
  // COMBO/DYNAMICCOMBO type with options array
  if (
    typeof specOptions === 'object' &&
    specOptions &&
    'options' in specOptions &&
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
      return firstOption.key
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
 * Results are memoized by the pricing rule and input definitions.
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
        ...nodeDef.input?.required,
        ...nodeDef.input?.optional
      }

      // Build widgets context using depends_on.widgets (matches buildJsonataContext)
      const widgets: Record<string, NormalizedWidgetValue> = {}
      for (const dep of priceBadge.depends_on.widgets) {
        const spec = allInputs[dep.name]
        let rawValue: unknown = null
        if (Array.isArray(spec)) {
          rawValue = extractDefaultFromSpec(spec)
        }
        widgets[dep.name] = normalizeWidgetValue(rawValue, dep.type)
      }
      if (Object.values(widgets).some((value) => value === null)) return ''

      // Build inputs context: assume all inputs are disconnected in preview
      const inputs: Record<string, { connected: boolean }> = {}
      for (const name of priceBadge.depends_on.inputs) {
        inputs[name] = { connected: false }
      }

      // Build inputGroups context: assume 0 connected inputs in preview
      const inputGroups: Record<string, number> = {}
      for (const groupName of priceBadge.depends_on.input_groups) {
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
  {
    getCacheKey: (nodeDef: ComfyNodeDef) =>
      JSON.stringify([nodeDef.name, nodeDef.price_badge, nodeDef.input])
  }
)

const PER_RUN_SUFFIX = '/Run'

/**
 * What one evaluated price result contributes to a per-run total: `per-run` is
 * summable, `per-unit` carries its unit, `unpriced` contributes nothing.
 */
export type NodeRunPrice =
  | {
      basis: 'per-run'
      minUsd: number
      maxUsd: number
      approximate: boolean
    }
  | {
      basis: 'per-unit'
      unit: string
      minUsd: number
      maxUsd: number
      approximate: boolean
    }
  | {
      basis: 'unpriced'
      reason: 'descriptive' | 'ambiguous' | 'invalid'
    }

const INVALID_PRICE: NodeRunPrice = { basis: 'unpriced', reason: 'invalid' }
const AMBIGUOUS_PRICE: NodeRunPrice = { basis: 'unpriced', reason: 'ambiguous' }

function declaredUnit(suffix: string | undefined): string {
  return (suffix ?? PER_RUN_SUFFIX).trim().replace(/^\//, '')
}

function isUsableBound(usd: number | null): usd is number {
  return usd !== null && usd >= 0
}

function numericBasis(
  minUsd: number,
  maxUsd: number,
  format: CreditFormatOptions | undefined
): NodeRunPrice {
  const suffix = format?.suffix
  if (suffix !== undefined && typeof suffix !== 'string') return INVALID_PRICE
  const unit = declaredUnit(suffix)
  if (unit === '') return AMBIGUOUS_PRICE

  const approximate = !!format?.approximate
  if (unit.toLowerCase() === 'run') {
    return format?.note === undefined
      ? { basis: 'per-run', minUsd, maxUsd, approximate }
      : AMBIGUOUS_PRICE
  }
  return { basis: 'per-unit', unit, minUsd, maxUsd, approximate }
}

function classifyScalar(
  usd: unknown,
  format: CreditFormatOptions | undefined
): NodeRunPrice {
  const value = asFiniteNumber(usd)
  if (!isUsableBound(value)) return INVALID_PRICE
  return numericBasis(value, value, format)
}

function classifyRange(
  result: Extract<PricingResult, { type: 'range_usd' }>
): NodeRunPrice {
  const minUsd = asFiniteNumber(result.min_usd)
  const maxUsd = asFiniteNumber(result.max_usd)
  if (!isUsableBound(minUsd) || !isUsableBound(maxUsd)) return INVALID_PRICE
  return numericBasis(
    Math.min(minUsd, maxUsd),
    Math.max(minUsd, maxUsd),
    result.format
  )
}

function classifyList(
  result: Extract<PricingResult, { type: 'list_usd' }>
): NodeRunPrice {
  if (result.usd.length === 0) return INVALID_PRICE
  let minUsd = Number.POSITIVE_INFINITY
  let maxUsd = Number.NEGATIVE_INFINITY
  for (const entry of result.usd) {
    const usd = asFiniteNumber(entry)
    if (!isUsableBound(usd)) return INVALID_PRICE
    minUsd = Math.min(minUsd, usd)
    maxUsd = Math.max(maxUsd, usd)
  }
  const basis = numericBasis(minUsd, maxUsd, result.format)
  if (basis.basis === 'per-run' && result.usd.length > 1) {
    return AMBIGUOUS_PRICE
  }
  return basis
}

function isLegacyUsdResult(result: unknown): result is { usd: unknown } {
  return (
    !!result &&
    typeof result === 'object' &&
    !('type' in result) &&
    'usd' in result
  )
}

/** Read an evaluated pricing result as a per-run cost basis, failing closed. */
export function classifyPricingResult(result: unknown): NodeRunPrice {
  if (isLegacyUsdResult(result)) return classifyScalar(result.usd, undefined)
  if (!isPricingResult(result)) return INVALID_PRICE

  switch (result.type) {
    case 'text':
      return { basis: 'unpriced', reason: 'descriptive' }
    case 'usd':
      return classifyScalar(result.usd, result.format)
    case 'range_usd':
      return classifyRange(result)
    default:
      return classifyList(result)
  }
}

/** One cost-bearing node, already evaluated against its current state. */
export type ApiNodeCostEntry = {
  nodeType: string
  nodeId?: string | number
  price: NodeRunPrice
}

/**
 * API-node per-run cost bounds in USD and unrounded credits, excluding cloud
 * GPU/execution cost; presentable only as a floor while `isLowerBound` holds.
 */
export type ApiNodeCostEstimate = {
  minUsd: number
  maxUsd: number
  minCredits: number
  maxCredits: number
  pricedCount: number
  perUnit: ApiNodeCostEntry[]
  unpriced: ApiNodeCostEntry[]
  coverage: 'complete' | 'partial' | 'none'
  isLowerBound: boolean
  approximate: boolean
}

function isSummableEntry(entry: ApiNodeCostEntry): boolean {
  return (
    entry.price.basis === 'per-run' &&
    Number.isFinite(entry.price.minUsd) &&
    Number.isFinite(entry.price.maxUsd) &&
    entry.price.minUsd >= 0 &&
    entry.price.minUsd <= entry.price.maxUsd
  )
}

/** Sum the per-run entries and return what was excluded from the bounds. */
export function estimateApiNodeRunCost(
  entries: readonly ApiNodeCostEntry[]
): ApiNodeCostEstimate {
  let minUsd = 0
  let maxUsd = 0
  let pricedCount = 0
  let approximate = false
  const perUnit: ApiNodeCostEntry[] = []
  const unpriced: ApiNodeCostEntry[] = []

  for (const entry of entries) {
    if (isSummableEntry(entry) && entry.price.basis === 'per-run') {
      minUsd += entry.price.minUsd
      maxUsd += entry.price.maxUsd
      pricedCount++
      approximate = approximate || entry.price.approximate
    } else if (entry.price.basis === 'per-unit') {
      perUnit.push(entry)
    } else {
      unpriced.push(entry)
    }
  }

  const hasFiniteTotals =
    Number.isFinite(minUsd) &&
    Number.isFinite(maxUsd) &&
    Number.isFinite(minUsd * CREDITS_PER_USD) &&
    Number.isFinite(maxUsd * CREDITS_PER_USD)
  if (!hasFiniteTotals) {
    unpriced.push(...entries.filter(isSummableEntry))
    minUsd = 0
    maxUsd = 0
    pricedCount = 0
  }

  const excluded = perUnit.length + unpriced.length
  const coverage: ApiNodeCostEstimate['coverage'] =
    excluded === 0 ? 'complete' : pricedCount === 0 ? 'none' : 'partial'

  return {
    minUsd,
    maxUsd,
    minCredits: minUsd * CREDITS_PER_USD,
    maxCredits: maxUsd * CREDITS_PER_USD,
    pricedCount,
    perUnit,
    unpriced,
    coverage,
    isLowerBound: excluded > 0,
    approximate
  }
}

/**
 * Evaluate one node's badge and report its per-run basis; an absent or
 * uncompilable badge is `unpriced`, never free.
 */
export async function evaluatePricingBasis(
  name: string,
  badge: PriceBadge | undefined,
  context: JsonataEvalContext
): Promise<NodeRunPrice> {
  const rule = badge ? getCompiledRuleForNodeType(name, badge) : null
  if (!rule?._compiled) return INVALID_PRICE
  try {
    return classifyPricingResult(await rule._compiled.evaluate(context))
  } catch {
    return INVALID_PRICE
  }
}
