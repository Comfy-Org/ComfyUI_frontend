import type { ComputedRef, InjectionKey, Ref } from 'vue'

import type { DropdownItemShape } from '@/base/remote/itemSchema'

export type RemoteComboPreviewType = 'image' | 'video' | 'audio'

export interface RemoteComboContext {
  isOpen: Ref<boolean>
  searchQuery: Ref<string>
  selectedValue: Ref<string | undefined>
  items: ComputedRef<DropdownItemShape[]>
  filteredItems: ComputedRef<DropdownItemShape[]>
  isLoading: ComputedRef<boolean>
  isFetching: ComputedRef<boolean>
  errorMessage: ComputedRef<string | null>
  refresh: () => Promise<void>
  select: (id: string) => void
  fieldLabel: ComputedRef<string>
  previewType: ComputedRef<RemoteComboPreviewType>
}

export const RemoteComboKey: InjectionKey<RemoteComboContext> =
  Symbol('RemoteComboContext')
