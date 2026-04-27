import { defineComponentKey } from '../componentKey'
import type { WidgetEntityId } from '../entityIds'

export interface WidgetDisplayState {
  label?: string
  disabled?: boolean
}

export const WidgetDisplayStateComponent = defineComponentKey<
  WidgetDisplayState,
  WidgetEntityId
>('WidgetDisplayState')
