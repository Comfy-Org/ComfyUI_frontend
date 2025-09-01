import type { InjectionKey, Ref } from 'vue'

import type { AlgoliaNodePack } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type { components as managerComponents } from '@/types/generatedManagerTypes'
import type { SearchMode } from '@/types/searchServiceTypes'

type WorkflowNodeProperties = ComfyWorkflowJSON['nodes'][0]['properties']

export type RegistryPack = components['schemas']['Node']
export type MergedNodePack = RegistryPack & AlgoliaNodePack
export const isMergedNodePack = (
  nodePack: RegistryPack | AlgoliaNodePack
): nodePack is MergedNodePack => 'comfy_nodes' in nodePack

export type PackField = keyof RegistryPack | null

export const IsInstallingKey: InjectionKey<Ref<boolean>> =
  Symbol('isInstalling')

export enum ManagerWsQueueStatus {
  DONE = 'all-done',
  IN_PROGRESS = 'in_progress'
}

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


export interface ManagerState {
  selectedTabId: ManagerTab
  searchQuery: string
  searchMode: 'nodes' | 'packs'
  sortField: string
}

/**
 * Types for import failure information API
 */
export type ImportFailInfoBulkRequest =
  managerComponents['schemas']['ImportFailInfoBulkRequest']
export type ImportFailInfoBulkResponse =
  managerComponents['schemas']['ImportFailInfoBulkResponse']
export type ImportFailInfoItem =
  managerComponents['schemas']['ImportFailInfoItem']
