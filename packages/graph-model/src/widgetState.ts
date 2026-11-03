import type { IBaseWidget, IWidgetOptions } from './widgets'
import type { NodeId } from './nodeId'
import type { WidgetValue } from './widgetValue'

export type ValueControlMode =
  | 'fixed'
  | 'increment'
  | 'increment-wrap'
  | 'decrement'
  | 'randomize'

export interface WidgetState<
  TValue = WidgetValue,
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
  nodeId: NodeId
}

export type WidgetStateInit<
  TValue = WidgetValue,
  TType extends string = string,
  TOptions extends IWidgetOptions = IWidgetOptions
> = Omit<WidgetState<TValue, TType, TOptions>, 'nodeId' | 'name' | 'y'> & {
  name?: string
  y?: number
}

export interface WidgetControlState {
  mode: ValueControlMode
  filter?: string
  hasExecuted: boolean
}

export interface WidgetControlConfig {
  mode: ValueControlMode
  hasFilter: boolean
  filter?: string
}
