import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'

export interface LinkReleaseContext {
  /** The data type of the slot the link was dragged from (e.g. "MODEL"). */
  dataType: string
  /** The name of the slot the link was dragged from (e.g. "model"). */
  slotName: string
  /**
   * Whether the released link originates from an output slot, meaning the new
   * node will be connected to via one of its inputs.
   */
  isFromOutput: boolean
}

type LinkReleaseCategoryKey = 'comfy' | 'extensions' | 'partner'

export interface LinkReleaseNodeCategory {
  key: LinkReleaseCategoryKey
  /** i18n key for the group heading. */
  labelKey: string
  /** Iconify class shown beside the group label. */
  icon: string
  /** Nodes in the group, sorted alphabetically by display name. */
  nodes: ComfyNodeDefImpl[]
}

const CATEGORY_META: Record<
  LinkReleaseCategoryKey,
  { labelKey: string; icon: string }
> = {
  comfy: { labelKey: 'contextMenu.Comfy Nodes', icon: 'icon-[lucide--box]' },
  extensions: {
    labelKey: 'contextMenu.Extensions',
    icon: 'icon-[lucide--puzzle]'
  },
  partner: {
    labelKey: 'contextMenu.Partner Nodes',
    icon: 'icon-[lucide--handshake]'
  }
}

const CATEGORY_ORDER: LinkReleaseCategoryKey[] = [
  'comfy',
  'extensions',
  'partner'
]

export function getLinkReleaseHeaderLabel(context: LinkReleaseContext): string {
  const { slotName, dataType } = context
  if (slotName && dataType) return `${slotName} | ${dataType}`
  return slotName || dataType
}

function classifyNode(node: ComfyNodeDefImpl): LinkReleaseCategoryKey {
  if (node.api_node || node.category?.startsWith('api node')) return 'partner'
  if (
    node.nodeSource.type === NodeSourceType.Core ||
    node.nodeSource.type === NodeSourceType.Essentials
  ) {
    return 'comfy'
  }
  return 'extensions'
}

function byDisplayName(a: ComfyNodeDefImpl, b: ComfyNodeDefImpl): number {
  return a.display_name.localeCompare(b.display_name)
}

/**
 * Group slot-compatible nodes into source buckets for the cascading menu.
 * Empty buckets are omitted and each bucket's nodes are sorted by display name.
 */
export function buildLinkReleaseNodeCategories(
  compatibleNodes: ComfyNodeDefImpl[]
): LinkReleaseNodeCategory[] {
  const buckets: Record<LinkReleaseCategoryKey, ComfyNodeDefImpl[]> = {
    comfy: [],
    extensions: [],
    partner: []
  }

  for (const node of compatibleNodes) {
    buckets[classifyNode(node)].push(node)
  }

  return CATEGORY_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    labelKey: CATEGORY_META[key].labelKey,
    icon: CATEGORY_META[key].icon,
    nodes: [...buckets[key]].sort(byDisplayName)
  }))
}

/** Quick-add suggestions for the released slot, excluding the Reroute node. */
export function getLinkReleaseSuggestions(
  defaultNodeDefs: ComfyNodeDefImpl[]
): ComfyNodeDefImpl[] {
  return defaultNodeDefs.filter((nodeDef) => nodeDef.name !== 'Reroute')
}

/** Case-insensitive filter of a node list by display name. */
export function filterNodesByName(
  nodes: ComfyNodeDefImpl[],
  query: string
): ComfyNodeDefImpl[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return nodes
  return nodes.filter((nodeDef) =>
    nodeDef.display_name.toLowerCase().includes(trimmed)
  )
}

/** A filtered group of nodes shown while searching the root menu. */
export interface LinkReleaseSearchSection {
  key: 'suggestions' | LinkReleaseCategoryKey
  /** i18n key for the section heading. */
  labelKey: string
  /** Iconify class shown beside the heading (omitted for Most Relevant). */
  icon?: string
  nodes: ComfyNodeDefImpl[]
}

/**
 * Search that mirrors the no-query layout: a Most Relevant section of matching
 * suggestions followed by a section per category with matching nodes. A node
 * present in both Most Relevant and a category appears in each section.
 * Empty sections are omitted; section order is Most Relevant, then categories.
 */
export function buildLinkReleaseSearchSections(
  suggestions: ComfyNodeDefImpl[],
  categories: LinkReleaseNodeCategory[],
  query: string
): LinkReleaseSearchSection[] {
  if (!query.trim()) return []

  const sections: LinkReleaseSearchSection[] = []
  const relevant = filterNodesByName(suggestions, query)
  if (relevant.length) {
    sections.push({
      key: 'suggestions',
      labelKey: 'contextMenu.Most Relevant',
      nodes: relevant
    })
  }

  for (const category of categories) {
    const nodes = filterNodesByName(category.nodes, query)
    if (nodes.length) {
      sections.push({
        key: category.key,
        labelKey: category.labelKey,
        icon: category.icon,
        nodes
      })
    }
  }

  return sections
}
