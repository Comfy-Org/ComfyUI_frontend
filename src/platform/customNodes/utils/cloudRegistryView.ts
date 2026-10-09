import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { groupBy } from 'es-toolkit'

export type RegistryFilter =
  | 'all'
  | 'pinned'
  | 'unpinned'
  | 'prepared'
  | 'verified'

export function cloudRegistryPacks(
  revisions: CloudNodeRegistryRevision[],
  filter: string | null,
  query: string,
  version: string | undefined,
  sort: string | undefined,
  tagsByRevision: ReadonlyMap<string, readonly string[]> = new Map(),
  tag?: string
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const groups = groupBy(revisions, (revision) => revision.name)
  return Object.entries(groups)
    .flatMap(([name, entries]) => {
      const matches = entries.filter((revision) => {
        if (
          version &&
          version !== 'all' &&
          String(revision.node_api_version) !== version
        ) {
          return false
        }
        if (filter === 'pinned' && !revision.pinned) return false
        if (filter === 'unpinned' && revision.pinned) return false
        if (filter === 'prepared' && !revision.prepared) return false
        if (filter === 'verified' && !revision.comfy_verified) return false
        const tags = tagsByRevision.get(revision.revision_id) ?? []
        if (tag && !tags.includes(tag)) return false
        const text = [name, revision.pack_id, ...revision.nodes, ...tags]
          .join(' ')
          .toLowerCase()
        return terms.every((term) => text.includes(term))
      })
      const preferred = matches.toSorted(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          Number(b.prepared) - Number(a.prepared) ||
          Number(Boolean(b.comfy_verified)) -
            Number(Boolean(a.comfy_verified)) ||
          a.revision_id.localeCompare(b.revision_id)
      )[0]
      return preferred
        ? [{ key: name, name, revisions: entries, displayRevision: preferred }]
        : []
    })
    .toSorted((a, b) =>
      sort === 'nodes'
        ? b.displayRevision.nodes.length - a.displayRevision.nodes.length ||
          a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)
    )
}
