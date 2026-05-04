export interface PackNode {
  name: string
  displayName: string
  category: string
  description?: string
  deprecated?: boolean
  experimental?: boolean
}

export interface Pack {
  id: string
  registryId?: string
  displayName: string
  description?: string
  bannerUrl?: string
  iconUrl?: string
  repoUrl?: string
  publisher?: {
    id: string
    name?: string
  }
  downloads?: number
  githubStars?: number
  latestVersion?: string
  license?: string
  lastUpdated?: string
  supportedOs?: string[]
  supportedAccelerators?: string[]
  nodes: PackNode[]
}

export interface NodesSnapshot {
  fetchedAt: string
  packs: Pack[]
}

export function isNodesSnapshot(value: unknown): value is NodesSnapshot {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as { fetchedAt?: unknown; packs?: unknown }
  return (
    typeof candidate.fetchedAt === 'string' && Array.isArray(candidate.packs)
  )
}
