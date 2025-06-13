import type { InjectionKey, Ref } from 'vue'

export const IsInstallingKey: InjectionKey<Ref<boolean>> =
  Symbol('isInstalling')

export enum ManagerTab {
  All = 'all',
  Installed = 'installed',
  Workflow = 'workflow',
  Missing = 'missing',
  UpdateAvailable = 'updateAvailable'
}

export enum SortableAlgoliaField {
  Downloads = 'total_install',
  Created = 'create_time',
  Updated = 'update_time',
  Publisher = 'publisher_id',
  Name = 'name'
}

export interface TabItem {
  id: ManagerTab
  label: string
  icon: string
}

export interface SearchOption<T> {
  id: T
  label: string
}

export type TaskLog = {
  taskName: string
  taskId: string
  logs: string[]
}

export interface UseNodePacksOptions {
  immediate?: boolean
  maxConcurrent?: number
}
