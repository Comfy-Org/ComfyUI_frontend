import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * Whether a node's serialized widget values can be *proven* to describe its own widget list.
 *
 * This is the gate for emitting `widgets_values_form` — a per-node declaration of which
 * widgets serialize and in what order. A node carrying a form is addressed through that form
 * and consults no widget catalog on any leg, so **a wrong form is authoritative**: it would
 * silently misplace values with no mismatch anywhere to detect it. A node with no form keeps
 * today's catalog behaviour, which is merely imperfect. So the asymmetry is total, and the
 * rule follows from it:
 *
 *   **Emit only where we can prove the final `widgets_values` is the array we produced from
 *   `node.widgets`. Otherwise do not emit.**
 *
 * Two things are wrong with the naive version — "derive the order from `node.widgets` after
 * the extension serialize hook". The order must be proven rather than derived, AND that call
 * site is not the last writer, so being handed a payload there proves nothing. Both are
 * measurable. `node.widgets` is a public JavaScript API
 * that extensions splice, truncate, reorder and replace wholesale (see ADR-ECS-WIDGETS-0023),
 * and `LGraphNode.serialize` is not the last writer: `SubgraphNode.serializeFromStoreState`
 * calls `super` — hook included — and then rebuilds `widgets_values` from a different
 * collection entirely. Deriving an order is a guess dressed as a declaration. Proving one is
 * not.
 *
 * Nothing here emits a form. This is the predicate and the diagnosis only, so it can be
 * landed, measured and trusted before any producer depends on it.
 */

/** Why a node's widget values could not be proven. `null` reason means they were. */
export type WidgetFormRefusal =
  /**
   * The node's class can still rewrite the payload after this point, so whatever we are
   * looking at is not final and proving anything about it would be premature.
   */
  | 'class_may_rewrite_payload'
  /** Replayed verbatim from a previous save; this process never built these values. */
  | 'replayed_serialization'
  /** `serialize_widgets` is falsy: widgets exist, values were never written. */
  | 'widgets_not_serialized'
  /** Values are not the array we produced — an extension or subclass replaced them. */
  | 'values_replaced'
  /** Values are an object; shape is the producer's own, not a positional array. */
  | 'values_not_positional'
  /** Length disagrees with the serializable widget list. */
  | 'length_mismatch'
  /** Two serializing widgets share a name, so a name-keyed order cannot address both. */
  | 'duplicate_widget_name'
  /** A widget's name is absent or not a string, so it cannot be an address. */
  | 'unnameable_widget'

export interface WidgetFormOptions {
  /** The node's `serialize_widgets` flag. */
  serializeWidgets?: boolean
  /** True when the payload was replayed from a previous save rather than built here. */
  replayed?: boolean
  /**
   * Whether core is the LAST thing that will write `widgets_values` for this node.
   *
   * Required, deliberately, with no default. The previous version of this module documented a
   * call site ("after the extension serialize hook") and assumed it was final, which is false
   * for any class that overrides serialization — `SubgraphNode` rewrites the values after
   * `super` returns, and packs override `serialize` to do the same. Assuming it is how the
   * proof came to accept a subgraph host.
   *
   * The only correct value is a comparison against the base implementation, made by the
   * caller because that is where both sides are in scope:
   *
   * ```ts
   * coreIsLastWriter:
   *   node.serializeFromStoreState === LGraphNode.prototype.serializeFromStoreState &&
   *   node.serialize === LGraphNode.prototype.serialize
   * ```
   *
   * It is a required field rather than a derived one so that a new call site cannot omit the
   * question: `tsc` refuses until it has been answered. Passing a hardcoded `true` to silence
   * it reintroduces exactly the defect above.
   */
  coreIsLastWriter: boolean
}

export interface WidgetFormProof {
  /** True only when every check below passed. Emit a form if and only if this is true. */
  provable: boolean
  /** Set when `provable` is false. */
  refusal: WidgetFormRefusal | null
  /**
   * The order, present only when `provable`. Never returned alongside a refusal — a partial
   * order is the failure mode this module exists to prevent.
   */
  order: string[] | null
}

function refuse(refusal: WidgetFormRefusal): WidgetFormProof {
  return { provable: false, refusal, order: null }
}

/**
 * The widgets that contribute a positional value, in order.
 *
 * `widget.serialize === false` is the ONLY predicate that governs `widgets_values`, and that
 * is easy to get wrong because two other spellings look interchangeable:
 * `widget.options.serialize === false` excludes a widget from the API prompt but NOT from
 * `widgets_values`, and promotion checks either. `addWidget` does not hoist the options-bag
 * flag onto the widget, so widgets flagged only there DO occupy positional slots — which is
 * why every `KSampler` serializes 7 values (`control_after_generate` is options-bag-only) and
 * every `LoadImage` serializes 2 (the upload button is too). Reading `options.serialize` here
 * would silently drop both and produce a form one slot short.
 */
function serializingWidgets(widgets: readonly IBaseWidget[]): IBaseWidget[] {
  return widgets.filter((widget) => widget.serialize !== false)
}

/**
 * Prove — or refuse to prove — that `serialised.widgets_values` describes `widgets`.
 *
 * @param widgets the node's live widget list at serialization time
 * @param serialised the node payload as it stands AFTER the extension serialize hook
 * @param producedValues the array `serialiseWidgetValues` returned BEFORE the hook ran, or
 *   `undefined` if it never ran. Identity is the proof: if the post-hook value is not this
 *   same array, something replaced it and we know nothing about what the replacement means.
 * @param options see {@link WidgetFormOptions}. `coreIsLastWriter` is required and is the
 *   check that keeps this a proof rather than an assumption.
 */
/**
 * Preconditions on the PAYLOAD, before any question about the values themselves.
 *
 * Both are things no inspection of `widgets_values` could reveal, which is why they have to be
 * told to us rather than derived.
 */
function preconditionRefusal(
  serialised: { has_errors?: boolean },
  options: WidgetFormOptions
): WidgetFormRefusal | null {
  // FIRST, because every later check reasons about a payload it assumes is final. If the node's
  // class can still rewrite `widgets_values`, the identity check compares against an array that
  // is about to be discarded, and it PASSES -- an acceptance, the one outcome this module exists
  // to prevent. Measured on `SubgraphNode`: at the end of `LGraphNode.serializeFromStoreState`
  // its values are still core's own array, and only the subclass's override replaces them
  // afterwards. The proof accepted, returning an order of two names for a payload that ended up
  // holding one value.
  if (!options.coreIsLastWriter) return 'class_may_rewrite_payload'

  // A replayed payload carries whatever shape some other frontend wrote, and the widget list
  // beside it may be synthesised placeholders: an unregistered node type gets widgets named
  // `UNKNOWN`, `UNKNOWN_1`, ... from its stored values. A form built there would be syntactically
  // valid, authoritative to every consumer, and meaningless.
  if (options.replayed || serialised.has_errors) return 'replayed_serialization'

  return null
}

/**
 * Phase 1: did core produce these exact values?
 *
 * Returns the array when yes, or the refusal when no. Split out because it is the only part
 * that reasons about provenance; everything after it reasons about names.
 */
function provenValues(
  widgets: readonly IBaseWidget[] | undefined,
  serialised: { widgets_values?: unknown; has_errors?: boolean },
  producedValues: unknown,
  options: WidgetFormOptions
): { values: unknown[] } | { refusal: WidgetFormRefusal } {
  // No values were written. A form with no array to describe is not a weaker claim than
  // usual — it is a claim about nothing, and `order` would be read as authoritative.
  if (!widgets?.length || !options.serializeWidgets) {
    return { refusal: 'widgets_not_serialized' }
  }

  const values = serialised.widgets_values
  // Identity, deliberately, not deep equality. A subclass or extension that rebuilt an
  // equal-looking array did so from a source we cannot see, and a coincidental match is not
  // evidence. This is the check that catches `SubgraphNode` and the packs that override
  // `serialize` to write values after `super` returns.
  if (producedValues === undefined || values !== producedValues) {
    return {
      refusal: Array.isArray(values)
        ? 'values_replaced'
        : 'values_not_positional'
    }
  }
  if (!Array.isArray(values)) return { refusal: 'values_not_positional' }
  return { values }
}

/**
 * Phase 2: can every serializing widget's name serve as an address?
 */
function addressableOrder(
  serializing: readonly IBaseWidget[]
): { order: string[] } | { refusal: WidgetFormRefusal } {
  const order: string[] = []
  const seen = new Set<string>()
  for (const widget of serializing) {
    const name = widget.name
    if (typeof name !== 'string' || name.length === 0) {
      return { refusal: 'unnameable_widget' }
    }
    // `serialiseWidgetValues` builds its named projection with `defineProperty`, so a repeat
    // silently overwrites the earlier value and the two become one key. An `order` array
    // would keep both and promise an address for each, but the document rejects the second
    // (`name#1` is an unknown widget there). Promising an address that does not resolve is
    // worse than declining to describe the node.
    if (seen.has(name)) return { refusal: 'duplicate_widget_name' }
    seen.add(name)
    order.push(name)
  }
  return { order }
}

/**
 * Prove — or refuse to prove — that `serialised.widgets_values` describes `widgets`.
 *
 * @param widgets the node's live widget list at serialization time
 * @param serialised the node payload as it stands AFTER the extension serialize hook
 * @param producedValues the array `serialiseWidgetValues` returned BEFORE the hook ran, or
 *   `undefined` if it never ran. Identity is the proof: if the post-hook value is not this
 *   same array, something replaced it and we know nothing about what the replacement means.
 * @param options see {@link WidgetFormOptions}. `coreIsLastWriter` is required and is the
 *   check that keeps this a proof rather than an assumption.
 */
export function proveWidgetForm(
  widgets: readonly IBaseWidget[] | undefined,
  // `widgets_values` is deliberately `unknown` rather than the serialised-node type's
  // `WidgetValue[]`. Every interesting input here VIOLATES that type: an extension replaced
  // the array with an object, or deleted it. Typing the parameter as the shape we expect
  // would make the shapes we are checking for unrepresentable, and the checks dead.
  serialised: {
    widgets_values?: unknown
    /** Present when the payload was replayed rather than built. */
    has_errors?: boolean
  },
  producedValues: unknown,
  options: WidgetFormOptions
): WidgetFormProof {
  const precondition = preconditionRefusal(serialised, options)
  if (precondition !== null) return refuse(precondition)

  const proven = provenValues(widgets, serialised, producedValues, options)
  if ('refusal' in proven) return refuse(proven.refusal)

  const serializing = serializingWidgets(widgets ?? [])
  // Reachable even with an untouched array: a widget mutated its own `serialize` flag between
  // the write and this check, or `widgets` was spliced in between.
  if (serializing.length !== proven.values.length)
    return refuse('length_mismatch')

  const addressed = addressableOrder(serializing)
  if ('refusal' in addressed) return refuse(addressed.refusal)

  return { provable: true, refusal: null, order: addressed.order }
}

/**
 * True when a node's values are object-shaped with no form to interpret them.
 *
 * This is the population that cannot be read back today: an object-shaped `widgets_values` is
 * stored whole and opaquely, so it round-trips but is not name-addressable, and the follower
 * drops it outright because it only accepts an array. Those nodes are exactly the ones a form
 * would rescue, and there is currently no way to count them — which is why the gap has stayed
 * invisible and unowned. Report it and the question "which classes still need this?" becomes a
 * number instead of an argument.
 */
export function needsFormButHasNone(serialised: {
  widgets_values?: unknown
  widgets_values_form?: unknown
}): boolean {
  const values = serialised.widgets_values
  return (
    values !== null &&
    typeof values === 'object' &&
    !Array.isArray(values) &&
    serialised.widgets_values_form === undefined
  )
}
