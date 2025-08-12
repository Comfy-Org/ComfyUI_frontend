import type { InjectionKey, Ref } from 'vue'

export interface SelectionOverlayState {
  visible: Readonly<Ref<boolean>>
  updateCount: Readonly<Ref<number>>
}

export const SelectionOverlayInjectionKey: InjectionKey<SelectionOverlayState> =
  Symbol('selectionOverlayState')
