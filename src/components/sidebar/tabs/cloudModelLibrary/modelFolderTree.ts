import { buildProviderGroups } from '@/components/sidebar/tabs/cloudModelLibrary/modelLibrarySort'
import type {
  ProviderGroup,
  SidebarItem,
  SortMode
} from '@/components/sidebar/tabs/cloudModelLibrary/modelLibrarySort'

/**
 * A folder level inside a library section, mirroring the user's own
 * sub-organisation on disk (`loras/anime/ghibli`). Items directly in the
 * folder render via provider groups; deeper paths nest as children.
 */
export interface FolderNode {
  /** Stable expansion key: `<sectionId>/<path segments>` */
  id: string
  /** Single path segment, shown verbatim. */
  name: string
  providers: ProviderGroup[]
  children: FolderNode[]
  totalCount: number
}

export interface TreeEntry {
  /** Path below this node ('' = directly in it). */
  subpath: string
  item: SidebarItem
}

export interface Section {
  id: string
  label: string
  totalCount: number
  /** Unmapped user folder shown verbatim, rendered after curated groups. */
  isUserFolder?: boolean
  root: FolderNode
}

export function buildTreeSection(
  id: string,
  label: string,
  entries: TreeEntry[],
  mode: SortMode,
  isSearching: boolean
): Section | null {
  if (entries.length === 0) return null
  const root = buildFolderNode(id, label, entries, mode, isSearching)
  return { id, label, totalCount: root.totalCount, root }
}

export function buildFolderNode(
  id: string,
  name: string,
  entries: TreeEntry[],
  mode: SortMode,
  isSearching: boolean
): FolderNode {
  const direct: SidebarItem[] = []
  const byChild = new Map<string, TreeEntry[]>()
  for (const entry of entries) {
    if (!entry.subpath) {
      direct.push(entry.item)
      continue
    }
    const [head, ...rest] = entry.subpath.split('/')
    const list = byChild.get(head) ?? []
    list.push({ subpath: rest.join('/'), item: entry.item })
    byChild.set(head, list)
  }
  const children = [...byChild.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([segment, childEntries]) =>
      buildFolderNode(
        `${id}/${segment}`,
        segment,
        childEntries,
        mode,
        isSearching
      )
    )
  return {
    id,
    name,
    providers: buildProviderGroups(direct, mode, isSearching),
    children,
    totalCount:
      direct.length + children.reduce((sum, child) => sum + child.totalCount, 0)
  }
}
