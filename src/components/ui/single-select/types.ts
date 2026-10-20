import type { StyleValue } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'

export type SingleSelectProps = SingleSelectBaseProps &
  (
    | { searchable?: false; searchLabel?: string; emptyText?: string }
    | { searchable: boolean; searchLabel: string; emptyText: string }
  )

interface SingleSelectBaseProps {
  label?: string
  accessibleLabel: string
  options?: SelectOption<string | number>[]
  size?: 'lg' | 'md'
  invalid?: boolean
  loading?: boolean
  disabled?: boolean
  searchPlaceholder?: string
  listMaxHeight?: string
  popoverMinWidth?: string
  popoverMaxWidth?: string
  contentStyle?: StyleValue
}
