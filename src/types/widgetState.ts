import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import type { NodeId } from '@/types/nodeId'

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
