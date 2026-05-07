import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

/**
 * `WidgetState` is a *derived view* over the four widget-side components
 * (`WidgetComponentValue` / `Display` / `Schema` / `Serialize`). Property
 * accessors are installed via `Object.defineProperty` and delegate live
 * to the world; reads always hit the underlying reactive proxies, so
 * Vue tracking propagates through the view.
 *
 * Object identity is **not** preserved across `getWidget` calls — each
 * call constructs a fresh view. Data semantics round-trip; identity does
 * not. Do not cache views or rely on `===`.
 *
 * `name` and `nodeId` are not present on the view: they live in the
 * underlying `WidgetEntityId` and would be a redundant copy here. Callers
 * that need them should derive from the entity id (or from the BaseWidget
 * instance, which still owns them).
 */
export type WidgetState<
  TValue = unknown,
  TType extends string = string,
  TOptions extends IWidgetOptions = IWidgetOptions
> = Pick<
  IBaseWidget<TValue, TType, TOptions>,
  'value' | 'options' | 'label' | 'serialize' | 'disabled' | 'type'
>

/**
 * Input shape for `registerWidget`: a `WidgetState` view augmented with the
 * identity fields (`name`, `nodeId`) needed to construct the widget's
 * `WidgetEntityId`. The view returned from `registerWidget` is the
 * un-augmented `WidgetState` because identity fields live in the entity id.
 */
export interface WidgetRegistration<
  TValue = unknown
> extends WidgetState<TValue> {
  name: string
  nodeId: NodeId
}
