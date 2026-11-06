export interface RegistryCustomNode {
  name: string
  id: string
  registryVersion: string
}

export interface GitCustomNode {
  name: string
  id?: string
  repository: string
  commit?: string
  gitRef?: string
}

export interface UploadedCustomNode {
  name: string
  blobId: string
}

/** A custom node entry of a Build definition, as comfy-builder stores it. */
export type BuildCustomNode =
  | RegistryCustomNode
  | GitCustomNode
  | UploadedCustomNode

export interface PendingReleaseMove {
  release_id: string
  status: string
  since: string
}

/** The Build behind a deployment and the Release it runs. */
export interface DeploymentBuild {
  revision: number
  pending_update: PendingReleaseMove | null
  release: { release_id: string; version: number }
  build: {
    build_id: string
    name: string
    updated_at: string
    custom_nodes: BuildCustomNode[]
  }
  can_change_build: boolean
}

export interface SavedCustomNodes {
  updated_at: string
}

export interface StartedRelease {
  release_id: string
  version: number
}

export interface ReleaseTimelineEntry {
  phase: string
  level: 'info' | 'error'
  message: string
  at: string
}

/** A Release of the deployment's Build while comfy-builder builds it. */
export interface ReleaseBuild {
  release_id: string
  version: number
  status: 'queued' | 'building' | 'complete'
  deployable: boolean
  target: {
    status: 'queued' | 'building' | 'ready' | 'failed'
    failure_reason?: string
  }
  timeline: ReleaseTimelineEntry[]
}

export interface ReleaseMove {
  revision: number
  release_id: string
  pending_update: PendingReleaseMove | null
}

export type ServiceOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string }

/** A node pack on the Comfy Registry. */
export interface NodePack {
  id: string
  name: string
  publisher: string
  installs: number
  stars: number
  license: string
  repository?: string
  latestVersion?: string
}

export interface NodePackPage {
  packs: NodePack[]
  hasMore: boolean
}
