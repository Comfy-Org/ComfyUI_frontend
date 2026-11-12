import type { StyleValue } from 'vue'

import type { SelectOption } from '@comfyorg/design-system/lib/select/types'

export type MultiSelectProps = MultiSelectBaseProps &
  (
    | { showSearchBox?: false; searchLabel?: string }
    | { showSearchBox: boolean; searchLabel: string }
  ) &
  (
    | { showClearButton?: false; clearAllLabel?: string }
    | { showClearButton: boolean; clearAllLabel: string }
  ) &
  (
    | {
        showSelectedCount?: false
        formatSelectedCount?: (count: number) => string
      }
    | {
        showSelectedCount: boolean
        formatSelectedCount: (count: number) => string
      }
  )

export interface MultiSelectBaseProps {
  accessibleLabel: string
  emptyText: string
  label?: string
  options?: SelectOption[]
  size?: 'lg' | 'md'
  disabled?: boolean
  actionsPlacement?: 'header' | 'footer'
  searchPlaceholder?: string
  listMaxHeight?: string
  popoverMinWidth?: string
  popoverMaxWidth?: string
  contentStyle?: StyleValue
}
