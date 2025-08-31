export interface NavItemData {
  id: string
  label: string
  iconName?: string
}

export interface NavGroupData {
  title: string
  items: NavItemData[]
}
