import { inject } from 'vue'
import type { InjectionKey } from 'vue'

export type AssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'model'
  | 'mesh'
  | 'unknown'

export const OnCloseKey: InjectionKey<() => void> = Symbol()

export const HideLayoutFieldKey: InjectionKey<boolean> = Symbol()
export function useHideLayoutField(): boolean {
  return inject(HideLayoutFieldKey, false)
}

export const WidgetHeightKey: InjectionKey<string> = Symbol()
export function useWidgetHeight(): string {
  return inject(WidgetHeightKey, 'h-6')
}
