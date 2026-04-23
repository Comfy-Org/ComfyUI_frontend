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

// Suppresses AppInput's linear-mode selection checkbox when provided
// true by an ancestor. Used inside the App Mode / App Builder floating
// panel — the widgets there are already picked inputs, so the checkbox
// just mirrors graph-side selection and duplicates an affordance that
// lives on the canvas. Hiding it keeps the panel WYSIWYG with App Mode
// runtime (which never renders the checkbox).
export const HideInputSelectionKey: InjectionKey<boolean> = Symbol()
export function useHideInputSelection(): boolean {
  return inject(HideInputSelectionKey, false)
}
