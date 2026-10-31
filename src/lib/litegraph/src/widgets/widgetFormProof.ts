interface WidgetForFormProof {
  name: string
  serialize?: boolean
}

type WidgetFormRefusal =
  | 'class_may_rewrite_payload'
  | 'replayed_serialization'
  | 'widgets_not_serialized'
  | 'values_missing'
  | 'values_replaced'
  | 'values_not_positional'
  | 'length_mismatch'
  | 'duplicate_widget_name'
  | 'unnameable_widget'

/** Options for {@link proveWidgetForm}. See ADR-ECS-WIDGETS-0023. */
export interface WidgetFormOptions {
  /** The node's `serialize_widgets` flag. */
  serializeWidgets?: boolean
  /** True when the payload was replayed from a previous save rather than built here. */
  replayed?: boolean
  /** True when the node uses core's base serialization implementations. */
  coreIsLastWriter: boolean
}

/** The verdict from {@link proveWidgetForm}. `order` is present only when `provable`. */
export interface WidgetFormProof {
  provable: boolean
  refusal: WidgetFormRefusal | null
  order: string[] | null
}

function refuse(refusal: WidgetFormRefusal): WidgetFormProof {
  return { provable: false, refusal, order: null }
}

function serializingWidgets(
  widgets: readonly WidgetForFormProof[]
): WidgetForFormProof[] {
  return widgets.filter((widget) => widget.serialize !== false)
}

function preconditionRefusal(
  serialised: { has_errors?: boolean },
  options: WidgetFormOptions
): WidgetFormRefusal | null {
  if (!options.coreIsLastWriter) return 'class_may_rewrite_payload'
  if (options.replayed || serialised.has_errors) return 'replayed_serialization'
  return null
}

function provenValues(
  widgets: readonly WidgetForFormProof[] | undefined,
  serialised: { widgets_values?: unknown; has_errors?: boolean },
  producedValues: unknown,
  options: WidgetFormOptions
): { values: unknown[] } | { refusal: WidgetFormRefusal } {
  if (!widgets?.length || !options.serializeWidgets) {
    return { refusal: 'widgets_not_serialized' }
  }

  const values = serialised.widgets_values
  if (values === undefined) return { refusal: 'values_missing' }
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

function addressableOrder(
  serializing: readonly WidgetForFormProof[]
): { order: string[] } | { refusal: WidgetFormRefusal } {
  const order: string[] = []
  const seen = new Set<string>()
  for (const widget of serializing) {
    const name = widget.name
    if (typeof name !== 'string' || name.length === 0) {
      return { refusal: 'unnameable_widget' }
    }
    if (seen.has(name)) return { refusal: 'duplicate_widget_name' }
    seen.add(name)
    order.push(name)
  }
  return { order }
}

/** Proves whether core's final positional values match the live widget order. */
export function proveWidgetForm(
  widgets: readonly WidgetForFormProof[] | undefined,
  serialised: {
    widgets_values?: unknown
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
  if (serializing.length !== proven.values.length)
    return refuse('length_mismatch')

  const addressed = addressableOrder(serializing)
  if ('refusal' in addressed) return refuse(addressed.refusal)

  return { provable: true, refusal: null, order: addressed.order }
}

/** True when object-shaped widget values have no form that interprets them. */
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
