/**
 * Simplified widget interface for Vue-based node rendering
 * Removes all DOM manipulation and positioning concerns
 */
import { COMBO_CONTROL_MODES } from '@/core/graph/widgets/control/valueControl'
import type { ValueControlMode } from '@/core/graph/widgets/control/valueControl'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'

export type { WidgetValue } from '@comfyorg/graph-model/widgetValue'

export const CONTROL_OPTIONS = COMBO_CONTROL_MODES
export type ControlOptions = ValueControlMode

function isControlOption(value: unknown): value is ControlOptions {
  return CONTROL_OPTIONS.some((option) => option === value)
}

export function normalizeControlOption(val: WidgetValue): ControlOptions {
  if (isControlOption(val)) return val
  return 'randomize'
}

export type SafeControlWidget = {
  value: ControlOptions
  update: (value: WidgetValue) => void
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

  controlWidget?: SafeControlWidget

  displayLabel?: string

  /** Localized display label (falls back to name if not provided) */
  label?: string

  linkedUpstream?: LinkedUpstreamInfo

  /** NodeLocatorId for the node that owns this widget's execution outputs */
  nodeLocatorId?: NodeLocatorId

  /** Override for use with subgraph promoted asset widgets*/
  nodeType?: string

  options?: O

  /** Optional serialization method for custom value handling */
  serializeValue?: () => unknown

  /** Optional input specification backing this widget */
  spec?: InputSpecV2

  tooltip?: string
}

export interface SimplifiedControlWidget<
  T extends WidgetValue = WidgetValue,
  O extends IWidgetOptions = IWidgetOptions
> extends SimplifiedWidget<T, O> {
  controlWidget: SafeControlWidget
}
