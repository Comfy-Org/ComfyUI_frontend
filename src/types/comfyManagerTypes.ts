import type { components } from '@/types/comfyRegistryTypes'

export interface TabItem {
  id: string
  label: string
  icon: string
}

export type NodeField = keyof components['schemas']['Node'] | null

export interface SearchOption<T> {
  id: T
  label: string
}
