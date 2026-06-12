import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

import type { WidgetId } from './widgetId'

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
  controlWidgetId: WidgetId
  filterWidgetId?: WidgetId
  hasExecuted: boolean
}
