import { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
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

export enum ManagerNodeStatus {
  INSTALLED = 'installed',
  DISABLED = 'disabled',
  NOT_INSTALLED = 'not_installed',
  IMPORT_FAILED = 'import_failed',
  NEEDS_UPDATE = 'needs_update'
}

export enum ManagerInstallStatus {
  IDLE = 'idle',
  INSTALLING = 'installing',
  INSTALLED = 'installed',
  FAILED = 'failed',
  NEEDS_RESTART = 'needs_restart'
}

export interface ManagerNodeVersion {
  id: string
  version: string
  date?: string
  sha?: string
  isLatest?: boolean
  changelog?: string
  deprecated?: boolean
}

export interface ManagerNode {
  id: string
  name: string
  title?: string
  description?: string
  author?: string
  repository?: string
  installed: boolean
  enabled: boolean
  version?: string
  availableVersions?: ManagerNodeVersion[]
  dependencies?: string[]
  tags?: string[]
  importFailed?: boolean
  installPath?: string
  cnr_id?: string // maps to comfyui registry node name (not id)
}

/**
 * Status of the ComfyUI-Manager task runner queue.
 */
export interface ManagerQueueStatus {
  /** `done_count` + `in_progress_count` + number of items queued */
  total_count: number
  /** number of items installed */
  done_count: number
  /** number of items currently being processed */
  in_progress_count: number
  /** task worker thread is alive, a queued operation is running */
  is_processing: boolean
}

export interface InstalledNodesResponse {
  nodes: ManagerNode[]
  total: number
}

export interface InstallNodeResponse {
  success: boolean
  message: string
  requiresRestart: boolean
}

export enum SelectedVersion {
  LATEST = 'latest',
  NIGHTLY = 'nightly'
}

export enum ManagerChannel {
  DEFAULT = 'default',
  RECENT = 'recent',
  LEGACY = 'legacy',
  FORKED = 'forked',
  DEV = 'dev',
  TUTORIAL = 'tutorial'
}

export enum ManagerSourceMode {
  REMOTE = 'remote',
  LOCAL = 'local',
  CACHE = 'cache'
}

export interface ManagerPackOperation {
  /**
   * Display name of a pack.
   *
   * Corresponds to:
   * - `Node#name` (comfy-api)
   * - `ComfyNodeDef#python_module` (ComfyUI_frontend)
   * - `LGraphNode#properties#cnr_id` (LiteGraph node instances)
   * - `node#properties#cnr_id` (Comfy workflow files)
   */
  id:
    | ComfyWorkflowJSON['nodes'][0]['properties']['aux_id']
    | ComfyWorkflowJSON['nodes'][0]['properties']['cnr_id']

  /**
   * Display name of a pack version. Semantic version string or Git commit hash.
   *
   * Corresponds to
   * - `NodeVersion#version` (comfy-api)
   * - `LGraphNode#properties#ver` (LiteGraph node instances)
   * - `node#properties#ver` (Comfy workflow files)
   */
  version?: ComfyWorkflowJSON['nodes'][0]['properties']['ver']
}

/**
 * Payload for installing a pack.
 * Is also used to enable a disabled pack.
 */
export interface InstallPackParams extends ManagerPackOperation {
  /**
   * @deprecated Use `selected_version` instead.
   */
  version?: string
  /**
   * Semantic version string, Git commit hash, or `latest`/`nightly`.
   */
  selected_version?: ManagerPackOperation['version'] | SelectedVersion
  /**
   * The github link to the repository of the node to install. Required if `selected_version` is `nightly`.
   */
  repository: string
  /**
   * List of PyPi dependencies associated with the node. Used to determine whether the node
   * should be installed based on user's security level configuration.
   */
  pip?: string[]
  /**
   * The channel to install the node from.
   * Unused by ComfyUI_frontend.
   * @default ManagerChannel.DEFAULT
   */
  channel?: ManagerChannel
  /**
   * The mode to install the node in.
   * @default InstallMode.NORMAL
   */
  mode?: ManagerSourceMode
  skip_post_install?: boolean
}
