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

type GridPackNode = Pick<PackNode, 'name' | 'displayName' | 'category'>

export type GridPack = Pick<
  Pack,
  | 'id'
  | 'displayName'
  | 'description'
  | 'bannerUrl'
  | 'iconUrl'
  | 'repoUrl'
  | 'downloads'
  | 'lastUpdated'
> & { nodes: GridPackNode[] }

// PackGridSection/PackCard/NodeList only render and search these fields;
// dropping the rest (registryId, publisher, githubStars, latestVersion,
// license, supportedOs, supportedAccelerators, per-node description/
// deprecated/experimental) keeps the client-hydrated payload smaller.
export function toGridPack(pack: Pack): GridPack {
  return {
    id: pack.id,
    displayName: pack.displayName,
    description: pack.description,
    bannerUrl: pack.bannerUrl,
    iconUrl: pack.iconUrl,
    repoUrl: pack.repoUrl,
    downloads: pack.downloads,
    lastUpdated: pack.lastUpdated,
    nodes: pack.nodes.map((node) => ({
      name: node.name,
      displayName: node.displayName,
      category: node.category
    }))
  }
}

export function isNodesSnapshot(value: unknown): value is NodesSnapshot {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as { fetchedAt?: unknown; packs?: unknown }
  if (typeof candidate.fetchedAt !== 'string') return false
  if (!Array.isArray(candidate.packs)) return false

  return candidate.packs.every((pack) => {
    if (pack === null || typeof pack !== 'object') return false
    const p = pack as { id?: unknown; displayName?: unknown; nodes?: unknown }
    return (
      typeof p.id === 'string' &&
      typeof p.displayName === 'string' &&
      Array.isArray(p.nodes)
    )
  })
}
