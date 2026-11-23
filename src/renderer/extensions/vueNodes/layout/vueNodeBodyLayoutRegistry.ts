import type { InjectionKey, ShallowRef } from 'vue'

import type { BodyItem, PlacedBodyRow } from './vueNodeBodyLayout'

/** What a mounted Vue node's body parts hand to its layout, and what they read back. */
export interface VueNodeBodyContext {
  slotItems: ShallowRef<(() => BodyItem[]) | undefined>
  widgetItems: ShallowRef<(() => BodyItem[]) | undefined>
  rowOf: (key: string) => PlacedBodyRow | undefined
  reportContentHeight: (key: string, height: number) => void
}

export const vueNodeBodyKey: InjectionKey<VueNodeBodyContext> =
  Symbol('vueNodeBody')
