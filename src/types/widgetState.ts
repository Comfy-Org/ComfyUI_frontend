import type { ValueControlMode } from '@/core/graph/widgets/control/valueControl'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

export interface WidgetState<
  TValue = unknown,
  TType extends string = string,
  TOptions extends IWidgetOptions = IWidgetOptions
> extends Pick<
  IBaseWidget<TValue, TType, TOptions>,
  | 'name'
  | 'type'
  | 'value'
  | 'options'
  | 'label'
  | 'serialize'
  | 'disabled'
  | 'y'
> {
  isDOMWidget?: boolean
  nodeId: NodeId
}

export type WidgetStateInit<TValue = unknown> = Omit<
  WidgetState<TValue>,
  'nodeId' | 'name' | 'y'
> & { y?: number }

/** Control component for a target widget, keyed by the target's WidgetId. */
export interface WidgetControlState {
  mode: ValueControlMode
  /** Present (even as '') only for combo controls that carry a filter slot. */
  filter?: string
  hasExecuted: boolean
}

/** Transient control intent carried by a target widget until it is registered. */
export interface WidgetControlConfig {
  mode: ValueControlMode
  hasFilter: boolean
}
