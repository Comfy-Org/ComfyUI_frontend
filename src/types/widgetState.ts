import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import type { NodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'

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

export type WidgetStateInit<TValue = WidgetValue> = Omit<
  WidgetState<TValue>,
  'nodeId' | 'name' | 'y'
> & { y?: number }
