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

// -----------------------------
// Per-run cost basis, and the whole-graph estimate built from it
// -----------------------------
//
// Everything above renders ONE node's price for display. A pre-execution
// estimate for a whole run is a different question, and it cannot be answered
// by adding up those display strings:
//
//   - The UNIT is not part of the PriceBadge contract. It survives only as
//     `format.suffix`, a free-text display fragment that defaults to "/Run".
//     Measured against ComfyUI core's `comfy_api_nodes/` on 2026-11-04, 83 of
//     the 286 price results published there are NOT per run: 34 are
//     " per 1K tokens", 26 per second ("/second" and the variant "/sec"), 5 per
//     minute, 4 per image, 2 per 1K chars, and one each "/30 frames", "/8MP"
//     and " x images/Run" — the last being a per-run figure that the prose
//     silently multiplies by a widget. Nothing machine-readable separates those
//     from the 203 that are per run.
//   - `type: 'text'` carries no figure at all (core uses it for token-based LLM
//     nodes, Topaz interpolation, and Tripo's "Free"), and so does a rule that
//     fails to evaluate. Both render as prose or as '', which a string-summing
//     caller reads as zero.
//   - `formatCreditsValue` rounds to one decimal place, so summing the rendered
//     labels accumulates rounding error on every node.
//
// So a caller that sums labels produces a number that looks like the run's cost
// and is not. These two functions exist to make the alternative available: a
// numeric basis per node that is explicit about what it cannot price, and an
// aggregate that declares its own coverage instead of implying completeness.

/** The canonical per-run suffix, and `format.suffix`'s own default. */
const PER_RUN_SUFFIX = '/Run'

/**
 * What one evaluated price result can contribute to a per-run total.
 *
 * - `per-run` — a figure the run is charged once, so it can be summed.
 * - `per-unit` — a real figure, priced per a unit the graph does not fix
 *   (tokens, seconds, frames). It must not be summed, and `unit` is the
 *   declared suffix so a caller can say what it is priced by.
 * - `unpriced` — nothing summable. `reason` says why.
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
      /**
       * - `descriptive` — the rule returned prose (`type: 'text'`), which may
       *   name a real price ("Token-based") or a real zero ("Free"). Which one
       *   is not decidable here, so neither is assumed.
       * - `ambiguous` — a per-run `list_usd`. A list is rendered as
       *   "5/10/20" and core uses it only for input/output token pairs, so
       *   whether the entries are alternatives or components of one charge is
       *   not stated. Summing and taking the max are both guesses.
       * - `invalid` — not a pricing result, or one whose figures are not
       *   finite numbers.
       */
      reason: 'descriptive' | 'ambiguous' | 'invalid'
    }

/**
 * True only when the suffix positively declares a per-run charge: absent, or
 * exactly "/Run" ignoring case, surrounding space and the leading slash.
 *
 * Deliberately an equality test and not a `.endsWith('/Run')` one. Core
 * publishes `" x images/Run"`, a per-image price the label multiplies by a
 * widget in prose; reading its tail as per-run would understate every node
 * that uses it. Anything this cannot prove is per run is reported as per-unit,
 * which a caller excludes from the total — never silently added to it.
 */
const isPerRunSuffix = (suffix: string | undefined): boolean => {
  const normalized = (suffix ?? PER_RUN_SUFFIX)
    .trim()
    .toLowerCase()
    .replace(/^\//, '')
  return normalized === 'run'
}

/** The declared unit for a non-per-run price, trimmed of its display slash. */
const declaredUnit = (suffix: string | undefined): string =>
  (suffix ?? PER_RUN_SUFFIX).trim().replace(/^\//, '')

const numericBasis = (
  minUsd: number,
  maxUsd: number,
  format: CreditFormatOptions | undefined
): NodeRunPrice => {
  const approximate = format?.approximate === true
  if (!isPerRunSuffix(format?.suffix)) {
    return {
      basis: 'per-unit',
      unit: declaredUnit(format?.suffix),
      minUsd,
      maxUsd,
      approximate
    }
  }
  return { basis: 'per-run', minUsd, maxUsd, approximate }
}

/** The one answer every unreadable or non-finite figure gets. */
const INVALID_PRICE: NodeRunPrice = { basis: 'unpriced', reason: 'invalid' }

/** One finite figure charged once, or nothing. */
const classifyScalar = (
  usd: unknown,
  format: CreditFormatOptions | undefined
): NodeRunPrice => {
  const value = asFiniteNumber(usd)
  if (value === null) return INVALID_PRICE
  return numericBasis(value, value, format)
}

const classifyRange = (
  result: Extract<PricingResult, { type: 'range_usd' }>
): NodeRunPrice => {
  const minUsd = asFiniteNumber(result.min_usd)
  const maxUsd = asFiniteNumber(result.max_usd)
  if (minUsd === null || maxUsd === null) return INVALID_PRICE
  // The rater orders these bounds, but a published badge is hand-written, so
  // the pair is sorted rather than trusted: an inverted one would otherwise
  // make the aggregate's minimum exceed its maximum.
  return numericBasis(
    Math.min(minUsd, maxUsd),
    Math.max(minUsd, maxUsd),
    result.format
  )
}

const classifyList = (
  result: Extract<PricingResult, { type: 'list_usd' }>
): NodeRunPrice => {
  const usdValues = result.usd
    .map(asFiniteNumber)
    .filter((usd): usd is number => usd !== null)
  if (usdValues.length === 0) return INVALID_PRICE

  // A non-per-run list is excluded by its unit, which is the more useful
  // answer, so the unit is read first and the ambiguity below only decides
  // lists that do claim to be per run.
  const basis = numericBasis(
    Math.min(...usdValues),
    Math.max(...usdValues),
    result.format
  )
  if (basis.basis === 'per-unit' || usdValues.length === 1) return basis
  return { basis: 'unpriced', reason: 'ambiguous' }
}

/**
 * The legacy bare-`{ usd }` shape, which carries no format block and so takes
 * the default per-run suffix — the same reading formatPricingResult gives it.
 */
const isLegacyUsdResult = (result: unknown): result is { usd: unknown } =>
  !!result &&
  typeof result === 'object' &&
  !('type' in result) &&
  'usd' in result

/**
 * Read an evaluated pricing result as a per-run cost basis.
 *
 * Fail-closed in every direction: an unreadable result, a non-finite figure
 * and prose all report `unpriced` rather than zero, and a figure whose unit
 * cannot be proven to be per run reports `per-unit` rather than being treated
 * as one charge.
 */
export const classifyPricingResult = (result: unknown): NodeRunPrice => {
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

/** One cost-bearing node, already evaluated against its current widget state. */
export type ApiNodeCostEntry = {
  /** The node's class name, for naming what could not be priced. */
  nodeType: string
  /** The graph node, when the caller wants to point at it. */
  nodeId?: string | number
  price: NodeRunPrice
}

/**
 * A per-run cost estimate over the API nodes it was given.
 *
 * It is NOT an estimate of a whole cloud run: cloud GPU/execution cost is
 * billed separately and is not published per node, so nothing here can see it.
 * A caller presenting this figure has to say what it covers.
 */
export type ApiNodeCostEstimate = {
  /** Summed bounds over the per-run entries only, in USD. */
  minUsd: number
  maxUsd: number
  /**
   * The same bounds in Comfy credits, UNROUNDED. Rounding each node's credits
   * before summing is the error the billing path is explicit about avoiding
   * (dollars are converted from unrounded cents, never from rounded credits),
   * and it is worse here because the sum has one term per node. Round at the
   * display edge.
   */
  minCredits: number
  maxCredits: number
  /** How many entries contributed to the bounds. */
  pricedCount: number
  /** Cost-bearing entries priced per a unit the graph does not fix. */
  perUnit: ApiNodeCostEntry[]
  /** Cost-bearing entries carrying no usable figure. */
  unpriced: ApiNodeCostEntry[]
  /**
   * - `complete` — every entry contributed, so the bounds cover every API node
   *   supplied. Also the answer for no entries at all.
   * - `partial` — at least one entry contributed and at least one did not.
   * - `none` — entries were supplied and none of them could be priced, so the
   *   bounds are 0 and mean nothing.
   */
  coverage: 'complete' | 'partial' | 'none'
  /**
   * True when the bounds understate the API-node cost, because at least one
   * cost-bearing node was left out of them. The figure may only be presented
   * as a floor ("at least N") while this holds.
   */
  isLowerBound: boolean
  /** True when any contributing entry declared itself approximate. */
  approximate: boolean
}

/**
 * Sum the per-run entries and declare what was left out.
 *
 * The excluded entries are returned rather than counted so a caller can name
 * them, which is the difference between "~300 credits" and "at least 300
 * credits, plus Gemini priced per 1K tokens".
 */
export const estimateApiNodeRunCost = (
  entries: readonly ApiNodeCostEntry[]
): ApiNodeCostEstimate => {
  let minUsd = 0
  let maxUsd = 0
  let pricedCount = 0
  let approximate = false
  const perUnit: ApiNodeCostEntry[] = []
  const unpriced: ApiNodeCostEntry[] = []

  for (const entry of entries) {
    if (entry.price.basis === 'per-run') {
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
 * Evaluate one node's badge and report its per-run basis — the per-node half of
 * an `estimateApiNodeRunCost` walk, and the twin of `evaluatePricingContext`
 * for callers that need the figure instead of the label.
 *
 * An absent or uncompilable badge is `unpriced`/`invalid`, not free: an API node
 * whose price this build cannot read still charges the user.
 */
export async function evaluatePricingBasis(
  name: string,
  badge: PriceBadge | undefined,
  context: JsonataEvalContext
): Promise<NodeRunPrice> {
  const rule = badge ? getCompiledRuleForNodeType(name, badge) : null
  if (!rule?._compiled) return { basis: 'unpriced', reason: 'invalid' }
  try {
    return classifyPricingResult(await rule._compiled.evaluate(context))
  } catch {
    return { basis: 'unpriced', reason: 'invalid' }
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
