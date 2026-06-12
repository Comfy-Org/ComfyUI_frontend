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

/** A node surfaced by the root flat-value search, tagged with its category. */
export interface LinkReleaseNodeMatch {
  category: LinkReleaseNodeCategory
  node: ComfyNodeDefImpl
}

/**
 * Flat-value search across every category submenu: when the root search has
 * text we surface matching nodes inline (tagged with their category) so a node
 * can be picked straight from the root without first drilling into a submenu.
 * Results preserve category order, then per-category display-name order.
 */
export function searchLinkReleaseNodes(
  categories: LinkReleaseNodeCategory[],
  query: string
): LinkReleaseNodeMatch[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []
  const matches: LinkReleaseNodeMatch[] = []
  for (const category of categories) {
    for (const node of category.nodes) {
      if (node.display_name.toLowerCase().includes(trimmed)) {
        matches.push({ category, node })
      }
    }
  }
  return matches
}

/**
 * Vertical `alignOffset` (px) that makes a category submenu open level with the
 * root menu rather than with the hovered trigger row. Positioning the submenu's
 * top one content-padding above the root search field lines the submenu's own
 * search field up with the root search field, since both menus share the same
 * content padding and search-field markup.
 */
export function computeSubmenuAlignOffset(metrics: {
  triggerTop: number
  rootSearchTop: number
  contentPaddingTop: number
}): number {
  const { triggerTop, rootSearchTop, contentPaddingTop } = metrics
  return rootSearchTop - contentPaddingTop - triggerTop
}

/**
 * Max height (px) for a category submenu pinned level with the root menu. The
 * panel grows into the viewport space below its top, but never shrinks below
 * the root menu's height so it can always be at least as tall as the context
 * menu even when there is little room beneath it.
 */
export function computeSubmenuMaxHeight(metrics: {
  submenuTop: number
  contextMenuHeight: number
  viewportHeight: number
  margin: number
}): number {
  const { submenuTop, contextMenuHeight, viewportHeight, margin } = metrics
  return Math.max(contextMenuHeight, viewportHeight - submenuTop - margin)
}
