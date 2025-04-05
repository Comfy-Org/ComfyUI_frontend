import type { InjectionKey, Ref } from 'vue'

import type { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import type { components } from '@/types/comfyRegistryTypes'

type RegistryPack = components['schemas']['Node']
type WorkflowNodeProperties = ComfyWorkflowJSON['nodes'][0]['properties']
export type PackField = keyof RegistryPack | null

export const IsInstallingKey: InjectionKey<Ref<boolean>> =
  Symbol('isInstalling')

export interface TabItem {
  id: string
  label: string
  icon: string
}

export interface SearchOption<T> {
  id: T
  label: string
}

export type TaskLog = {
  taskName: string
  logs: string[]
}

export interface UseNodePacksOptions {
  immediate?: boolean
  maxConcurrent?: number
}

enum ManagerPackState {
  /** Pack is installed and enabled */
  INSTALLED = 'installed',
  /** Pack is installed but disabled */
  DISABLED = 'disabled',
  /** Pack is not installed */
  NOT_INSTALLED = 'not_installed',
  /** Pack failed to import */
  IMPORT_FAILED = 'import_failed',
  /** Pack has an update available */
  NEEDS_UPDATE = 'needs_update'
}

enum ManagerPackInstallType {
  /** Installed via git clone */
  GIT = 'git-clone',
  /** Installed via file copy */
  COPY = 'copy',
  /** Installed from the Comfy Registry */
  REGISTRY = 'cnr'
}

export enum SelectedVersion {
  /** Latest version of the pack from the registry */
  LATEST = 'latest',
  /** Latest commit of the pack from its GitHub repository */
  NIGHTLY = 'nightly'
}

export enum ManagerChannel {
  /** All packs except those with instability or security issues */
  DEFAULT = 'default',
  /** Packs that were recently updated */
  RECENT = 'recent',
  /** Packs that were superseded by distinct replacements of some type */
  LEGACY = 'legacy',
  /** Packs that were forked as a result of the original pack going unmaintained */
  FORKED = 'forked',
  /** Packs with instability or security issues suitable only for developers */
  DEV = 'dev',
  /** Packs suitable for beginners */
  TUTORIAL = 'tutorial'
}

export enum ManagerDatabaseSource {
  /** Get pack info from the Comfy Registry */
  REMOTE = 'remote',
  /** If set to `local`, the channel is ignored */
  LOCAL = 'local',
  /** Get pack info from the cached response from the Comfy Registry (1 day TTL) */
  CACHE = 'cache'
}

export interface ManagerQueueStatus {
  /** `done_count` + `in_progress_count` + number of items queued */
  total_count: number
  /** Task worker thread is alive, a queued operation is running */
  is_processing: boolean
  /** Number of items in the queue that have been completed */
  done_count: number
  /** Number of items in the queue that are currently running */
  in_progress_count: number
}

export interface ManagerPackInfo {
  /** Either github-author/github-repo or name of pack from the registry (not id) */
  id: WorkflowNodeProperties['aux_id'] | WorkflowNodeProperties['cnr_id']
  /** Semantic version or Git commit hash */
  version: WorkflowNodeProperties['ver']
}

export interface ManagerPackInstalled {
  /**
   * The version of the pack that is installed.
   * Git commit hash or semantic version.
   */
  ver: WorkflowNodeProperties['ver']
  /**
   * The name of the pack if the pack is installed from the registry.
   * Corresponds to `Node#name` in comfy-api.
   */
  cnr_id: WorkflowNodeProperties['cnr_id']
  /**
   * The name of the pack if the pack is installed from github.
   * In the format author/repo-name. If the pack is installed from the registry, this is `null`.
   */
  aux_id: WorkflowNodeProperties['aux_id'] | null
  enabled: boolean
}

/**
 * Returned by `/customnode/installed`
 */
export type InstalledPacksResponse = Record<
  NonNullable<RegistryPack['name']>,
  ManagerPackInstalled
>

/**
 * Returned by `/customnode/getlist`
 */
export interface ManagerPack extends ManagerPackInfo {
  /** Pack author name or 'Unclaimed' if the pack was added automatically via GitHub crawl. */
  author: components['schemas']['Node']['author']
  /** Files included in the pack */
  files: string[]
  /** The type of installation that was used to install the pack */
  reference: string
  /** The display name of the pack */
  title: string
  /** The latest version of the pack */
  cnr_latest: SelectedVersion
  /** The github link to the repository of the pack */
  repository: string
  /** The state of the pack */
  state: ManagerPackState
  /** The state of the pack update */
  'update-state': 'false' | 'true' | null
  /** The number of stars the pack has on GitHub. Distinct from registry stars */
  stars: number
  /**
   * The last time the pack was updated. In ISO 8601 format.
   * @example '2024-05-22 20:00:00'
   */
  last_update: string
  health: string
  description: string
  trust: boolean
  install_type: ManagerPackInstallType
}

/**
 * Returned by `/customnode/getmappings`.
 */
export type ManagerMappings = Record<
  NonNullable<components['schemas']['Node']['name']>,
  [
    /** List of ComfyNode names included in the pack */
    Array<components['schemas']['ComfyNode']['comfy_node_name']>,
    {
      /** The display name of the pack */
      title_aux: string
    }
  ]
>

/**
 * Payload for `/manager/queue/install`
 */
export interface InstallPackParams extends ManagerPackInfo {
  /**
   * Semantic version, Git commit hash, `latest`, or `nightly`.
   */
  selected_version: WorkflowNodeProperties['ver'] | SelectedVersion
  /**
   * The GitHub link to the repository of the pack to install.
   * Required if `selected_version` is `nightly`.
   */
  repository: string
  /**
   * List of PyPi dependency names associated with the pack.
   * Used in coordination with pip package whitelist and version lock features.
   */
  pip?: string[]
  mode: ManagerDatabaseSource
  channel: ManagerChannel
  skip_post_install?: boolean
}

/**
 * Params for `/manager/queue/update_all`
 */
export interface UpdateAllPacksParams {
  mode?: ManagerDatabaseSource
}

/**
 * Params for `/v2/manager/queue/batch` and returned by `/v2/manager/queue/history?id={batch_id}`
 */
export interface ManagerBatchParams {
  batch_id: string[]
  update?: ManagerPackInfo[]
  install?: InstallPackParams[]
  uninstall?: ManagerPackInfo[]
  disable?: ManagerPackInfo[]
  enable?: ManagerPackInfo[]
}

/**
 * Returned by `/v2/manager/queue/history_list`
 */
export interface ManagerHistoryItem {
  batch: ManagerBatchParams
  /** Maps pack id to result. If not `skip` or `success`, the value is the error message. */
  nodepack_result: {
    [key: string]: 'skip' | 'success' | string
  }
  model_result: {
    [key: string]: string
  }
  /** `ui_ids` of the lists that failed during the pre-screening stage before entering the task queue */
  failed: string[]
}
