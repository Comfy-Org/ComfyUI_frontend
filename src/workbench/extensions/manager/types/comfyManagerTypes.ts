import type { InjectionKey, Ref } from 'vue'

import type { AlgoliaNodePack } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'

/**
 * Identifier for a node pack from the Comfy Registry / Manager.
 *
 * Backed by the registry pack's `id` (typically a slug like `cnr_id` or
 * `aux_id`, possibly suffixed with `@version` for disabled packs). This alias
 * names that primitive at use sites (manager store, services, composables)
 * without changing structural typing.
 */
export type NodePackId = string

export type RegistryPack = components['schemas']['Node']
export type MergedNodePack = RegistryPack & AlgoliaNodePack
export const isMergedNodePack = (
  nodePack: RegistryPack | AlgoliaNodePack
): nodePack is MergedNodePack => 'comfy_nodes' in nodePack

export const IsInstallingKey: InjectionKey<Ref<boolean>> =
  Symbol('isInstalling')

export enum ManagerTab {
  All = 'all',
  NotInstalled = 'notInstalled',
  AllInstalled = 'allInstalled',
  UpdateAvailable = 'updateAvailable',
  Conflicting = 'conflicting',
  Workflow = 'workflow',
  Missing = 'missing',
  Unresolved = 'unresolved'
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
