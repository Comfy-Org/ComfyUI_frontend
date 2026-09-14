/**
 * Simplified widget interface for Vue-based node rendering
 * Removes all DOM manipulation and positioning concerns
 */
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import { IS_CONTROL_WIDGET } from '@/scripts/controlWidgetMarker'
import type { NodeId } from '@/types/nodeId'
import type { NodeLocatorId } from '@/types/nodeIdentification'

/** Valid types for widget values */
export type WidgetValue = string | number | boolean | object | undefined | null

export const CONTROL_OPTIONS = [
  'fixed',
  'increment',
  'decrement',
  'randomize'
] as const
export type ControlOptions = (typeof CONTROL_OPTIONS)[number]

function isControlOption(val: WidgetValue): val is ControlOptions {
  return CONTROL_OPTIONS.includes(val as ControlOptions)
}

function normalizeControlOption(val: WidgetValue): ControlOptions {
  if (isControlOption(val)) return val
  return 'randomize'
}

export type SafeControlWidget = {
  value: ControlOptions
  update: (value: WidgetValue) => void
}

export function getControlWidget(
  widget: IBaseWidget
): SafeControlWidget | undefined {
  const controlWidget = widget.linkedWidgets?.find((w) => w[IS_CONTROL_WIDGET])
  if (!controlWidget) return
  return {
    value: normalizeControlOption(controlWidget.value),
    update: (value) => (controlWidget.value = normalizeControlOption(value))
  }
}

export interface LinkedUpstreamInfo {
  nodeId: NodeId
  outputName?: string
}

export interface SimplifiedWidget<
  T extends WidgetValue = WidgetValue,
  O extends IWidgetOptions = IWidgetOptions
> {
  /** Display name of the widget */
  name: string

  /** Widget type identifier (e.g., 'STRING', 'INT', 'COMBO') */
  type: string

  /** Current value of the widget */
  value: T

  borderStyle?: string

  /** Callback fired when value changes */
  callback?: (value: T) => void

  /** Optional method to compute widget size requirements */
  computeSize?: () => { minHeight: number; maxHeight?: number }

  /** Localized display label (falls back to name if not provided) */
  label?: string

  /** Widget options including filtered PrimeVue props */
  options?: O

  /** Override for use with subgraph promoted asset widgets*/
  nodeType?: string

  /** Optional serialization method for custom value handling */
  serializeValue?: () => unknown

  /** NodeLocatorId for the node that owns this widget's execution outputs */
  nodeLocatorId?: NodeLocatorId

  /** Optional input specification backing this widget */
  spec?: InputSpecV2

  tooltip?: string

  controlWidget?: SafeControlWidget

  linkedUpstream?: LinkedUpstreamInfo
}

export interface SimplifiedControlWidget<
  T extends WidgetValue = WidgetValue,
  O extends IWidgetOptions = IWidgetOptions
> extends SimplifiedWidget<T, O> {
  controlWidget: SafeControlWidget
}
