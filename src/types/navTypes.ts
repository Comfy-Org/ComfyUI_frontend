import { DefineComponent, FunctionalComponent } from 'vue'

export interface NavItemData {
  id: string
  label: string
  icon: DefineComponent | FunctionalComponent
}

export interface NavGroupData {
  title: string
  items: NavItemData[]
}
