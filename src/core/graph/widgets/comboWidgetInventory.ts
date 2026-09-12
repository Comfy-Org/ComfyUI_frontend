import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'

export type ComboWidgetInventoryStatus = 'loading' | 'ready' | 'error'

export interface ComboWidgetInventory {
  getStatus(): ComboWidgetInventoryStatus
  waitForSettled(): Promise<void>
}

const inventories = new WeakMap<IComboWidget, ComboWidgetInventory>()

export function registerComboWidgetInventory(
  widget: IComboWidget,
  inventory: ComboWidgetInventory
): void {
  inventories.set(widget, inventory)
}

export function getComboWidgetInventory(
  widget: IComboWidget
): ComboWidgetInventory | undefined {
  return inventories.get(widget)
}
