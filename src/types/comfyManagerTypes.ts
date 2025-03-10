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

type PackName = components['schemas']['Node']['name']
type AuxId = ComfyWorkflowJSON['nodes'][0]['properties']['aux_id']
type CnrId = ComfyWorkflowJSON['nodes'][0]['properties']['cnr_id']
type WorkflowPackVersion = ComfyWorkflowJSON['nodes'][0]['properties']['ver']

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
  CACHE = 'cache',
  /** @description Packs that were present at ComfyUI startup */
  IMPORTED = 'imported'
}

export enum ManagerPackState {
  INSTALLED = 'installed',
  DISABLED = 'disabled',
  NOT_INSTALLED = 'not_installed',
  IMPORT_FAILED = 'import_failed',
  NEEDS_UPDATE = 'needs_update'
}

export enum ManagerPackUpdateState {
  FALSE = 'false'
}

export enum ManagerPackInstallType {
  GIT = 'git-clone'
}

export interface ManagerPackInfo {
  /**
   * Display name of a pack.
   *
   * Corresponds to:
   * - `Node#name` (comfy-api)
   * - `ComfyNodeDef#python_module` (ComfyUI_frontend)
   * - `LGraphNode#properties#cnr_id` (LiteGraph node instances)
   * - `node#properties#cnr_id` (Comfy workflow files)
   */
  id: AuxId | CnrId

  /**
   * Display name of a pack version. Semantic version string or Git commit hash.
   *
   * Corresponds to
   * - `NodeVersion#version` (comfy-api)
   * - `LGraphNode#properties#ver` (LiteGraph node instances)
   * - `node#properties#ver` (Comfy workflow files)
   */
  version?: WorkflowPackVersion
}

/** Returned by /customnode/getlist */
export interface ManagerPack extends ManagerPackInfo {
  /** @description The github username of the pack author. */
  author?: string
  /** @description The description of the pack. */
  description?: string
  /** @todo unknown */
  files: string[]
  /** @description The type of installation that was used to install the pack. */
  install_type: ManagerPackInstallType
  /** @todo unknown */
  reference?: string
  /** @description The display name of the pack. */
  title?: string
  /** @description The latest version of the pack. */
  cnr_latest: SelectedVersion
  /** @todo unknown */
  health: string
  /** @description The github link to the repository of the pack. */
  repository?: string
  /** @description The state of the pack. */
  state: ManagerPackState
  /** @description The state of the pack update. */
  'update-state': ManagerPackUpdateState
  /** @description The number of stars the pack has on GitHub. Distinct from registry stars. */
  stars: number
  /**
   * @description The last time the pack was updated. In ISO 8601 format.
   * @example '2024-05-22 20:00:00'
   */
  last_update: string
  /** @todo unknown */
  trust: boolean
}

export interface ManagerPackInstalled {
  /** @description The version of the pack that is installed. Git commit hash or semantic version. */
  ver: WorkflowPackVersion
  /** @description The name of the pack if the pack is installed from the registry. Corresponds to `Node#name` in comfy-api. */
  cnr_id: CnrId
  /**
   * @description The name of the pack if the pack is installed from github.
   * In the format author/repo-name. If the pack is installed from the registry, this is `null`.
   */
  aux_id: AuxId | null
  /** @description Whether the pack is enabled. */
  enabled: boolean
}

/**
 * Status of the ComfyUI-Manager task runner queue.
 */
export interface ManagerQueueStatus {
  /** @description `done_count` + `in_progress_count` + number of items queued */
  total_count: number
  /** @description number of items installed */
  done_count: number
  /** @description number of items currently being processed */
  in_progress_count: number
  /** @description task worker thread is alive, a queued operation is running */
  is_processing: boolean
}

/**
 * Payload for installing a pack. Is also used to enable a disabled pack.
 */
export interface InstallPackParams extends ManagerPackInfo {
  /**
   * @deprecated Use `selected_version` instead.
   */
  version?: string
  /**
   * @description Semantic version string, Git commit hash, or `latest`/`nightly`.
   */
  selected_version?: WorkflowPackVersion | SelectedVersion
  /**
   * @description The github link to the repository of the node to install. Required if `selected_version` is `nightly`.
   */
  repository?: string
  /**
   * @description List of PyPi dependencies associated with the node.
   * Used to determine whether the node should be installed based on
   * user's security level configuration.
   */
  pip?: string[]
  /**
   * @description The channel to install the node from. Unused by ComfyUI_frontend.
   * @default ManagerChannel.DEFAULT
   */
  channel?: ManagerChannel
  /**
   * @description The mode to install the node in.
   * @default InstallMode.NORMAL
   */
  mode?: ManagerSourceMode
  skip_post_install?: boolean
}

/**
 * Response from /customnode/installed
 */
export type InstalledPacksResponse = Record<
  NonNullable<PackName>,
  ManagerPackInstalled
>
