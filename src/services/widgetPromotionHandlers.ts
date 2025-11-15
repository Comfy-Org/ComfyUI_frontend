import { shallowRef } from 'vue'

import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

type WidgetPromotionHandlers = {
  addWidgetPromotionOptions?: (
    options: (IContextMenuValue<unknown> | null)[],
    widget: IBaseWidget,
    node: LGraphNode
  ) => void
  tryToggleWidgetPromotion?: () => void
}

const handlersRef = shallowRef<WidgetPromotionHandlers>({})

export const registerWidgetPromotionHandlers = (
  handlers: WidgetPromotionHandlers
) => {
  handlersRef.value = handlers
  return () => {
    if (handlersRef.value === handlers) {
      handlersRef.value = {}
    }
  }
}

export const invokeToggleWidgetPromotion = () => {
  handlersRef.value.tryToggleWidgetPromotion?.()
}

export const addWidgetPromotionOptions = (
  options: (IContextMenuValue<unknown> | null)[],
  widget: IBaseWidget,
  node: LGraphNode
) => {
  handlersRef.value.addWidgetPromotionOptions?.(options, widget, node)
}
