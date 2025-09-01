import type { InjectionKey, Ref } from 'vue'

import type { AlgoliaNodePack } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'

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

export enum ManagerSortField {
  Author = 'author',
  CreateDate = 'creation_date',
  LastUpdateDate = 'last_update',
  Name = 'name',
  Stars = 'stars',
  Size = 'size'
}

export enum PackEnableState {
  Enabled,
  Disabled,
  NotInstalled
}

export type TaskLog = {
  taskName: string
  taskId: string
  logs: string[]
}

export interface ManagerQueueOptions {
  maxConcurrent?: number
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

// Node pack types from different sources
export type RegistryPack = components['schemas']['Node']

// MergedNodePack is the intersection of AlgoliaNodePack and RegistryPack
// created by lodash merge operation: merge({}, algoliaNodePack, registryPack)
export type MergedNodePack = AlgoliaNodePack & RegistryPack

/**
 * Type guard to check if a node pack is from Algolia (has comfy_nodes)
 */
export function isMergedNodePack(
  pack: MergedNodePack | RegistryPack
): pack is MergedNodePack {
  return 'comfy_nodes' in pack && Array.isArray(pack.comfy_nodes)
}

export interface ManagerState {
  selectedTabId: ManagerTab
  searchQuery: string
  searchMode: 'nodes' | 'packs'
  sortField: string
}
