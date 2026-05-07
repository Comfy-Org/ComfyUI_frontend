import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { defineComponentKeys, slot } from '@/world/componentKey'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'

/**
 * Per-bucket widget component shapes. Each bucket carves a disjoint slice
 * of {@link IBaseWidget} so the component stores stay in sync with the
 * source of truth in `src/lib/litegraph/src/types/widgets.ts`.
 */
type WidgetValue = Pick<IBaseWidget<unknown>, 'value'>
type WidgetDisplay = Pick<IBaseWidget, 'label' | 'disabled'>
type WidgetSchema = Pick<IBaseWidget, 'type' | 'options'>
type WidgetSerialize = Pick<IBaseWidget, 'serialize'>

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
  Value: slot<WidgetValue, WidgetEntityId>(),
  Display: slot<WidgetDisplay, WidgetEntityId>(),
  Schema: slot<WidgetSchema, WidgetEntityId>(),
  Serialize: slot<WidgetSerialize, WidgetEntityId>(),
  Container: slot<WidgetContainer, NodeEntityId>()
})
