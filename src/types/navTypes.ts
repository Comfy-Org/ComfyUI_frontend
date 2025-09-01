import { DefineComponent } from 'vue'

export interface NavItemData {
  id: string
  label: string
  icon: DefineComponent
}

export interface NavGroupData {
  title: string
  items: NavItemData[]
}
