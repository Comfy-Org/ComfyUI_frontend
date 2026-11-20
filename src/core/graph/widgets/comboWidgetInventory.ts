import type { IComboWidget } from '@comfyorg/graph-model/widgets'

export type ComboWidgetInventoryStatus = 'loading' | 'ready' | 'error'

export interface ComboWidgetInventory {
  getStatus(): ComboWidgetInventoryStatus
  waitForSettled(signal?: AbortSignal): Promise<void>
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
