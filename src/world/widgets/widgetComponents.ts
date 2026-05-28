import { defineComponentKeys, slot } from '@/world/componentKey'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'

/**
 * Source of truth for the data half of widgets. `IBaseWidget` in litegraph
 * extends these shapes so the world's per-bucket component stores stay in
 * sync without depending on litegraph.
 */
export interface WidgetValueShape<TValue = unknown> {
  value?: TValue
}

export interface WidgetDisplayShape {
  label?: string
  /**
   * Disabled widgets are rendered at half opacity. See also
   * the renderer's computed disabled state on `IBaseWidget.computedDisabled`.
   */
  disabled?: boolean
}

export interface WidgetSchemaShape<TOptions extends object = object> {
  type: string
  options: TOptions
}

export interface WidgetSerializeShape {
  /**
   * Whether the widget value is persisted in the workflow JSON
   * (`widgets_values`). Distinct from `IWidgetOptions.serialize`, which
   * controls whether the value is included in the API prompt sent for
   * execution. See `src/lib/litegraph/docs/WIDGET_SERIALIZATION.md`.
   *
   * @default true
   */
  serialize?: boolean
}

interface WidgetContainer {
  widgetIds: WidgetEntityId[]
}

export const {
  WidgetComponentValue,
  WidgetComponentDisplay,
  WidgetComponentSchema,
  WidgetComponentSerialize,
  WidgetComponentContainer
} = defineComponentKeys('Widget', {
  Value: slot<WidgetValueShape, WidgetEntityId>(),
  Display: slot<WidgetDisplayShape, WidgetEntityId>(),
  Schema: slot<WidgetSchemaShape, WidgetEntityId>(),
  Serialize: slot<WidgetSerializeShape, WidgetEntityId>(),
  Container: slot<WidgetContainer, NodeEntityId>()
})
