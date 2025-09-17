export interface NavItemData {
  id: string
  label: string
  icon: string
}

export interface NavGroupData {
  title: string
  items: NavItemData[]
  icon?: string
  collapsible?: boolean
}
