/**
 * Whether the Agent wire may declare a node's widget form, and the four
 * invariants that decide it.
 *
 * `widgets_values_form` tells the host which order its name-keyed registers
 * belong in. A node that carries one consults no catalogue on any leg, so a
 * wrong form is authoritative and strictly worse than no form: the rule is a
 * proof, not a derivation. Where a leg cannot be proven, nothing is declared.
 *
 * Every check reads the POST-HOOK payload, and that is the whole point.
 * `LGraphNode.serializeFromStoreState` writes `widgets_values` /
 * `widgets_values_named` from `node.widgets` and *then* calls
 * `runExtensionSerializeHook`, which copies an extension's own writes back
 * over both fields because they are in `NODE_CANONICAL_FIELDS`. So "one loop
 * emits the values and the order, therefore they cannot drift" is false, and
 * it is false in exactly the population the hook exists for — third-party
 * packs with custom serializers. A pre-hook check would assert the one thing
 * that was never in doubt.
 *
 * See docs/adr/WIDGET-SERIALIZATION-0047-agent-wire-widget-form-is-proven-not-derived.md
 */
import type { WidgetValuesForm } from '@comfyorg/comfy-multi-player'

import { assert } from '@/base/assert'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetState } from '@/types/widgetState'
import { widgetId } from '@/types/widgetId'

/** The post-hook halves of a serialized node this module reads. */
type SerializedWidgetValues = Pick<ISerialisedNode, 'widgets_values_named'>

/**
 * Why no form was declared. The first four are invariant violations: the
 * values and the order disagree, so declaring either would publish a state no
 * other reader sees. The rest are shapes a correct producer legitimately
 * cannot describe, and they are the population invariant 4 counts.
 */
type WidgetFormSuppression =
  /** Invariant 1 — an entry names no live widget core would serialise. */
  | 'order_names_unserialized_widget'
  /** Invariant 2 — declared order and value keys differ in either direction. */
  | 'declared_keys_disagree'
  /** Invariant 3 — the hook changed the values carried by the Agent wire. */
  | 'hook_changed_serialized_widgets'
  /** The catalogue owns this order: it is a function of the values. */
  | 'value_dependent_layout'
  /** A missing-node shell round-trips a stored payload, not live widgets. */
  | 'shell_last_serialization'
  /** A custom serialization hook threw before producing a payload. */
  | 'serialization_failed'
  /** A value the document carries has no live widget to order. */
  | 'value_has_no_live_widget'
  /** Nothing to declare. */
  | 'no_value_widgets'
  /** An unnamed widget cannot be addressed by name. */
  | 'unnamed_value_widget'
  /** Two value widgets share a name, so the order is ambiguous. */
  | 'duplicate_widget_name'

/**
 * Nothing to declare is not a declaration gap: a node whose only widgets are
 * buttons has no named value for a form to order, so counting it would bury
 * invariant 4's signal under every such class in the ecosystem.
 */
const UNREPORTED: ReadonlySet<WidgetFormSuppression> = new Set([
  'no_value_widgets'
])

type SuppressedWidgetFormVerdict = {
  readonly declared: false
  readonly reason: WidgetFormSuppression
  readonly detail?: Record<string, unknown>
}

export type WidgetFormVerdict =
  | { readonly declared: true; readonly form: WidgetValuesForm }
  | SuppressedWidgetFormVerdict

const ADR =
  'docs/adr/WIDGET-SERIALIZATION-0047-agent-wire-widget-form-is-proven-not-derived.md'

/**
 * Assertion text, one per broken invariant. Membership of this record is what
 * makes a reason an invariant violation rather than a shape we cannot
 * describe. `assert` forwards the message to external telemetry and groups on
 * it, so each is a static description of the invariant that broke plus where
 * it is written down — never a value.
 */
const INVARIANT_MESSAGES: Partial<Record<WidgetFormSuppression, string>> = {
  order_names_unserialized_widget:
    'Agent widget form invariant 1: a declared order entry names no live widget with serialize !== false, so the form orders a widget core never serialises — ' +
    `see ${ADR}`,
  declared_keys_disagree:
    'Agent widget form invariant 2: the declared order and the object-shaped widgets_values keys differ in one direction or the other, so the form either orders an absent value or drops a stored one — ' +
    `see ${ADR}`,
  hook_changed_serialized_widgets:
    'Agent widget form invariant 3: the extension serialize hook changed which live value widgets reach the Agent wire, so the form no longer describes the values sent — ' +
    `see ${ADR}`
}

const UNDECLARED_FORM_MESSAGE =
  'Agent widget form invariant 4: object-shaped widget values with no declared form'

const VALUE_DEPENDENT_LAYOUT_INPUT_TYPES = new Set([
  'COMFY_AUTOGROW_V3',
  'COMFY_DYNAMICCOMBO_V3',
  'COMFY_DYNAMICGROUP_V3'
])

export interface WidgetFormSuppressionTally {
  /** The node class, so a population is attributable without a join. */
  readonly nodeType: string
  readonly reason: WidgetFormSuppression
  readonly count: number
}

const tally = new Map<
  string,
  { nodeType: string; reason: WidgetFormSuppression; count: number }
>()
const reported = new Set<string>()
const MAX_SUPPRESSION_KEYS = 100

const tallyKey = (nodeType: string, reason: WidgetFormSuppression): string =>
  JSON.stringify([nodeType, reason])

/**
 * Up to the first 100 distinct suppressions this page session saw, by class
 * and reason.
 *
 * This is the bulk instrument. A corpus run reads it once at the end instead
 * of scraping telemetry, and `nodeType` makes the answer a class-by-class
 * breakdown rather than a pass/fail. Pair it with
 * {@link widgetValuesFormVerdict} to classify a node without minting anything.
 */
export function widgetFormSuppressionTally(): WidgetFormSuppressionTally[] {
  return [...tally.values()].map((entry) => ({ ...entry }))
}

/** Drops the accumulated tally. For tests and for a fresh corpus pass. */
export function resetWidgetFormSuppressionTally(): void {
  tally.clear()
  reported.clear()
}

function record(nodeType: string, reason: WidgetFormSuppression): void {
  const key = tallyKey(nodeType, reason)
  const seen = tally.get(key)
  if (seen) {
    seen.count += 1
    return
  }
  if (tally.size >= MAX_SUPPRESSION_KEYS) return
  tally.set(key, { nodeType, reason, count: 1 })
}

function firstReport(nodeType: string, reason: WidgetFormSuppression): boolean {
  const key = tallyKey(nodeType, reason)
  if (reported.has(key) || reported.size >= MAX_SUPPRESSION_KEYS) return false
  reported.add(key)
  return true
}

function suppressed(
  reason: WidgetFormSuppression,
  detail?: Record<string, unknown>
): SuppressedWidgetFormVerdict {
  return detail
    ? { declared: false, reason, detail }
    : { declared: false, reason }
}

function sameNames(left: readonly string[], right: readonly string[]): boolean {
  const a = new Set(left)
  const b = new Set(right)
  return a.size === b.size && [...a].every((name) => b.has(name))
}

/**
 * Whether the live widget, or the store metadata the intent was keyed by when
 * the live widget is missing or omits a field, identifies a value the document
 * carries. Unknown widgets fail closed.
 */
export function isValueWidget(
  widget: IBaseWidget | undefined,
  stored?: WidgetState
): boolean {
  if (!widget && !stored) return false
  // A destructuring default fires on absent AND present-but-undefined alike,
  // which is what `IBaseWidget`'s own optional fields mean: the live widget
  // did not state this, so the registration the intent was keyed by answers.
  // One construct for both fields, so the two halves of the guard cannot
  // drift apart again.
  const { type = stored?.type, serialize = stored?.serialize } = widget ?? {}
  return type !== 'button' && serialize !== false
}

/** The named values the document carries, dropping non-value widgets. */
export function valueWidgetsOnly(
  node: LGraphNode,
  named: object
): Record<string, unknown> {
  const filtered: Record<string, unknown> = Object.create(null)
  const rootGraphId = node.graph?.rootGraph.id
  const widgetValueStore = useWidgetValueStore()
  for (const [name, value] of Object.entries(named)) {
    const stored = rootGraphId
      ? widgetValueStore.getWidget(widgetId(rootGraphId, node.id, name))
      : undefined
    const carriesValue = node.widgets?.some(
      (candidate) => candidate.name === name && isValueWidget(candidate, stored)
    )
    if (carriesValue)
      Object.defineProperty(filtered, name, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      })
  }
  return filtered
}

/** The post-hook payload and the live widget list, read once. */
interface FormProof {
  /** Every live widget's name, serialised or not. */
  readonly liveNames: readonly string[]
  /** The names of live widgets whose values the Agent wire carries. */
  readonly valueWidgetNames: readonly string[]
  /** The enumerable keys of the object the wire ships. */
  readonly valueNames: readonly string[]
  /** The order the form would declare. */
  readonly order: readonly string[]
}

function formProof(
  node: LGraphNode,
  values: Record<string, unknown>,
  _serialized: SerializedWidgetValues
): FormProof {
  const live = node.widgets ?? []
  const rootGraphId = node.graph?.rootGraph.id
  const widgetValueStore = useWidgetValueStore()
  const valueWidgetNames = live
    .filter((widget) => {
      const stored = rootGraphId
        ? widgetValueStore.getWidget(
            widgetId(rootGraphId, node.id, widget.name)
          )
        : undefined
      return isValueWidget(widget, stored)
    })
    .map((widget) => widget.name)
  return {
    liveNames: live.map((widget) => widget.name),
    valueWidgetNames,
    valueNames: Object.keys(values),
    order: valueWidgetNames.filter((name) => Object.hasOwn(values, name))
  }
}

/** Returns a suppression when this leg of the proof fails, else nothing. */
type FormProbe = (proof: FormProof) => WidgetFormVerdict | undefined

/**
 * Invariant 3 — compare the key set that survives the Agent wire's value
 * filter with the live value widgets. Positional values and extension-private
 * entries are not sent, so neither can invalidate this proof.
 */
const hookKeptTheSerialisedWidgets: FormProbe = ({
  valueNames,
  valueWidgetNames
}) =>
  sameNames(valueNames, valueWidgetNames)
    ? undefined
    : suppressed('hook_changed_serialized_widgets', {
        wire: valueNames,
        live: valueWidgetNames
      })

/**
 * A document value with no live widget at all is the stored-state family, not
 * a broken invariant: the node shed the widget, or was never registered.
 * Checked before invariant 1 so the two are not conflated — "there is no
 * widget" and "there is one core refuses to serialise" have different causes
 * and different fixes.
 */
const everyValueHasALiveWidget: FormProbe = ({ valueNames, liveNames }) => {
  const unbacked = valueNames.filter((name) => !liveNames.includes(name))
  return unbacked.length
    ? suppressed('value_has_no_live_widget', { names: unbacked })
    : undefined
}

/**
 * Invariant 1 — an order entry must name a live widget core serialises.
 * Reachable only if a value for a `serialize: false` widget gets into
 * `values`, which `isValueWidget` currently refuses: this is the guard on
 * that filter.
 */
const orderNamesSerialisedWidgets: FormProbe = ({
  order,
  valueWidgetNames
}) => {
  const unserialized = order.filter((name) => !valueWidgetNames.includes(name))
  return unserialized.length
    ? suppressed('order_names_unserialized_widget', { names: unserialized })
    : undefined
}

/**
 * Invariant 2 — the object case, as a set difference in BOTH directions.
 * Order without a value orders nothing; a value outside the order is residue
 * the host would store and never project. Stated against the enumerable keys,
 * because those are what travel: the wire ships `values` as JSON, so an own
 * property `Object.hasOwn` can see and `Object.keys` cannot is an order entry
 * whose value never arrives.
 */
const declaredKeysAgree: FormProbe = ({ valueNames, order }) => {
  const undeclared = valueNames.filter((name) => !order.includes(name))
  const unvalued = order.filter((name) => !valueNames.includes(name))
  return undeclared.length || unvalued.length
    ? suppressed('declared_keys_disagree', { undeclared, unvalued })
    : undefined
}

/** Shapes a name-keyed order cannot address, whatever the values say. */
const orderIsAddressable: FormProbe = ({ order }) => {
  if (!order.length) return suppressed('no_value_widgets')
  if (order.some((name) => !name.length))
    return suppressed('unnamed_value_widget')
  if (new Set(order).size !== order.length)
    return suppressed('duplicate_widget_name', { order })
  return undefined
}

/**
 * Ordered most-specific-cause first, so the reason names the thing that
 * actually happened rather than its downstream shadow: the hook changing the
 * serialised widget set shows up as a key disagreement too, and attributing
 * it to the key disagreement would send a reader looking in the wrong place.
 */
const FORM_PROBES: readonly FormProbe[] = [
  everyValueHasALiveWidget,
  orderNamesSerialisedWidgets,
  declaredKeysAgree,
  hookKeptTheSerialisedWidgets,
  orderIsAddressable
]

/**
 * Classifies a node's form without declaring, asserting or reporting
 * anything. Pure apart from the node-definition read, so a bulk pass can call
 * it per node and keep the reason.
 */
export function classifyWidgetValuesForm(
  node: LGraphNode,
  values: Record<string, unknown>,
  serialized: SerializedWidgetValues
): WidgetFormVerdict {
  // The catalogue owns a value-dependent order; declaring one would close a
  // list that is supposed to expand with the selection.
  if (layoutDependsOnValues(node)) return suppressed('value_dependent_layout')

  // A missing-node shell round-trips its stored payload verbatim, so the
  // serialized values describe a class this build cannot see and the live
  // widget list — fabricated or empty — cannot order them.
  if (node.last_serialization) return suppressed('shell_last_serialization')

  const proof = formProof(node, values, serialized)
  for (const probe of FORM_PROBES) {
    const failed = probe(proof)
    if (failed) return failed
  }
  return { declared: true, form: { order: [...proof.order] } }
}

/**
 * Classifies a node end to end, for a bulk pass that holds a node and not a
 * serialization. It runs the node's serialization hook and tallies the
 * result, but does not assert or report.
 */
export function widgetValuesFormVerdict(node: LGraphNode): WidgetFormVerdict {
  if (node.last_serialization) {
    const verdict = suppressed('shell_last_serialization')
    record(node.type, verdict.reason)
    return verdict
  }
  let serialized: ISerialisedNode
  try {
    serialized = node.serialize()
  } catch {
    const verdict = suppressed('serialization_failed')
    record(node.type, verdict.reason)
    return verdict
  }
  const named = serialized.widgets_values_named
  if (!named) {
    const verdict = suppressed('no_value_widgets')
    record(node.type, verdict.reason)
    return verdict
  }
  const verdict = classifyWidgetValuesForm(
    node,
    valueWidgetsOnly(node, named),
    serialized
  )
  if (!verdict.declared) record(node.type, verdict.reason)
  return verdict
}

/**
 * The form to put on the wire, or nothing.
 *
 * Suppression is the gate in every environment. `assert` throws under DEV
 * only, so it is the invariant channel and not the mechanism — and the throw
 * is swallowed here on purpose, because every one of these invariants is
 * breakable by a third-party pack. A pack must not be able to stop the Agent
 * from minting in a developer's browser; it must only be unable to make us
 * publish a form that describes the wrong values.
 */
export function provenWidgetValuesForm(
  node: LGraphNode,
  values: Record<string, unknown>,
  serialized: SerializedWidgetValues
): WidgetValuesForm | undefined {
  const verdict = classifyWidgetValuesForm(node, values, serialized)
  if (verdict.declared) return verdict.form

  const nodeType = node.type
  record(nodeType, verdict.reason)
  const first =
    !UNREPORTED.has(verdict.reason) && firstReport(nodeType, verdict.reason)

  const invariantMessage = INVARIANT_MESSAGES[verdict.reason]
  if (first && invariantMessage) {
    try {
      assert(false, invariantMessage, { nodeType, ...verdict.detail })
    } catch {
      // Swallowed on purpose; see this function's contract above.
    }
  }

  // Invariant 4. One report per class and reason: the question is "which
  // classes still declare no form, and why", and a corpus pass that mints
  // thousands of nodes must answer it without thousands of reports.
  if (first) {
    reportError(new Error(UNDECLARED_FORM_MESSAGE), {
      errorType: 'agent_widget_form_undeclared',
      surface: 'agent',
      level: 'warning',
      tags: { node_type: nodeType, reason: verdict.reason },
      fingerprint: ['agent_widget_form_undeclared', verdict.reason, nodeType],
      context: { adr: ADR, ...verdict.detail }
    })
  }

  return undefined
}

function layoutDependsOnValues(node: LGraphNode): boolean {
  const definition = useNodeDefStore().fromLGraphNode(node)
  return Object.values(definition?.inputs ?? {}).some((spec) =>
    VALUE_DEPENDENT_LAYOUT_INPUT_TYPES.has(spec.type)
  )
}
