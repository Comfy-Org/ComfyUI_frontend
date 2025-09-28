import type { InjectionKey, Ref } from 'vue'

import type { AlgoliaNodePack } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'

export type RegistryPack = components['schemas']['Node']
export type MergedNodePack = RegistryPack & AlgoliaNodePack
export const isMergedNodePack = (
  nodePack: RegistryPack | AlgoliaNodePack
): nodePack is MergedNodePack => 'comfy_nodes' in nodePack

export const IsInstallingKey: InjectionKey<Ref<boolean>> =
  Symbol('isInstalling')

export enum ManagerTab {
  All = 'all',
  Installed = 'installed',
  Workflow = 'workflow',
  Missing = 'missing',
  UpdateAvailable = 'updateAvailable'
}

export interface TabItem {
  id: ManagerTab
  label: string
  icon: string
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

export interface SearchOption<T> {
  id: T
  label: string
}

export enum SortableAlgoliaField {
  Downloads = 'total_install',
  Created = 'create_time',
  Updated = 'update_time',
  Publisher = 'publisher_id',
  Name = 'name'
}

export interface ManagerState {
  selectedTabId: ManagerTab
  searchQuery: string
  searchMode: 'nodes' | 'packs'
  sortField: string
}
