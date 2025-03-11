import type { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import type { components } from '@/types/comfyRegistryTypes'

type RegistryPack = components['schemas']['Node']
type WorkflowNodeProperties = ComfyWorkflowJSON['nodes'][0]['properties']
export type NodeField = keyof RegistryPack | null

export type PackWithSelectedVersion = {
  nodePack: RegistryPack
  selectedVersion?: InstallPackParams['selected_version']
}

export interface TabItem {
  id: string
  label: string
  icon: string
}

export interface SearchOption<T> {
  id: T
  label: string
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
  /** Installed from the Comfy Node Registry */
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
  /** The github username of the pack author */
  author: string
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
 * Payload for posting to `/manager/queue/install`
 */
export interface InstallPackParams extends ManagerPackInfo {
  /**
   * Semantic version, Git commit hash, `latest`, or `nightly`.
   */
  selected_version: WorkflowNodeProperties['ver'] | SelectedVersion
  /**
   * If set to `imported`, returns only the packs that were imported at app startup.
   */
  mode: 'imported' | null
  /**
   * The GitHub link to the repository of the node to install.
   * Required if `selected_version` is `nightly`.
   */
  repository: string
  /**
   * List of PyPi dependencies associated with the node.
   * Used to determine whether the node should be installed based on
   * user's security level configuration and package whitelist/locks.
   */
  pip?: string[]
  channel: ManagerChannel
  skip_post_install?: boolean
}
