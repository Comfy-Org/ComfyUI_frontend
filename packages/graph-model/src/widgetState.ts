import type { IBaseWidget, IWidgetOptions } from './widgets'
import type { NodeId } from './nodeId'
import type { WidgetValue } from './widgetValue'

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
