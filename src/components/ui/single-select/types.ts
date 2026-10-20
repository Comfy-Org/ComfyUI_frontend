import type { StyleValue } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'

export interface SingleSelectProps {
  label?: string
  accessibleLabel: string
  searchLabel: string
  emptyText: string
  options?: SelectOption<string | number>[]
  size?: 'lg' | 'md'
  invalid?: boolean
  loading?: boolean
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  listMaxHeight?: string
  popoverMinWidth?: string
  popoverMaxWidth?: string
  contentStyle?: StyleValue
}
