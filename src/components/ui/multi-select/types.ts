import type { StyleValue } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'

export interface MultiSelectProps {
  accessibleLabel: string
  searchLabel: string
  emptyText: string
  clearAllLabel: string
  formatSelectedCount: (count: number) => string
  label?: string
  options?: SelectOption[]
  size?: 'lg' | 'md'
  disabled?: boolean
  showSearchBox?: boolean
  showSelectedCount?: boolean
  showClearButton?: boolean
  actionsPlacement?: 'header' | 'footer'
  searchPlaceholder?: string
  listMaxHeight?: string
  popoverMinWidth?: string
  popoverMaxWidth?: string
  contentStyle?: StyleValue
}
