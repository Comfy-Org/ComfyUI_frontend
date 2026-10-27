import type { IBaseWidget, IWidgetOptions } from '@comfyorg/graph-model/widgets'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'

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
