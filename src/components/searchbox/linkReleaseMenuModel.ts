import type { MenuItem } from 'primevue/menuitem'

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

declare module 'primevue/menuitem' {
  interface MenuItem {
    isHeader?: boolean
    isSearch?: boolean
    isGroupLabel?: boolean
  }
}

export interface LinkReleaseMenuHandlers {
  selectNode: (nodeDef: ComfyNodeDefImpl) => void
  addReroute: () => void
}

export interface LinkReleaseMenuModelOptions {
  context: LinkReleaseContext
  /** All nodes compatible with the slot type, for grouping into source buckets. */
  compatibleNodes: ComfyNodeDefImpl[]
  /** Quick-add node suggestions for the released slot type. */
  defaultNodeDefs: ComfyNodeDefImpl[]
  /** Current search field value. */
  query: string
  /** Slot-type-filtered search results when query is non-empty. */
  searchResults: ComfyNodeDefImpl[]
  t: (key: string) => string
  handlers: LinkReleaseMenuHandlers
}

export function getLinkReleaseHeaderLabel(context: LinkReleaseContext): string {
  const { slotName, dataType } = context
  if (slotName && dataType) return `${slotName} | ${dataType}`
  return slotName || dataType
}

function classifyNodes(nodes: ComfyNodeDefImpl[]): {
  comfy: ComfyNodeDefImpl[]
  extensions: ComfyNodeDefImpl[]
  partner: ComfyNodeDefImpl[]
} {
  const comfy: ComfyNodeDefImpl[] = []
  const extensions: ComfyNodeDefImpl[] = []
  const partner: ComfyNodeDefImpl[] = []

  for (const node of nodes) {
    if (node.api_node || node.category?.startsWith('api node')) {
      partner.push(node)
    } else if (
      node.nodeSource.type === NodeSourceType.Core ||
      node.nodeSource.type === NodeSourceType.Essentials
    ) {
      comfy.push(node)
    } else {
      extensions.push(node)
    }
  }

  return { comfy, extensions, partner }
}

function toNodeGroupItem(
  label: string,
  nodes: ComfyNodeDefImpl[],
  selectNode: (nodeDef: ComfyNodeDefImpl) => void
): MenuItem | null {
  if (!nodes.length) return null
  const sorted = [...nodes].sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  )
  return {
    label,
    items: sorted.map((nodeDef) => ({
      label: nodeDef.display_name,
      command: () => selectNode(nodeDef)
    }))
  }
}

function buildAddRerouteItem(
  t: (key: string) => string,
  handlers: LinkReleaseMenuHandlers
): MenuItem {
  return {
    label: t('contextMenu.Add Reroute'),
    icon: 'icon-[lucide--git-fork]',
    command: handlers.addReroute
  }
}

function buildDefaultMenuItems(
  suggestions: ComfyNodeDefImpl[],
  compatibleNodes: ComfyNodeDefImpl[],
  t: (key: string) => string,
  handlers: LinkReleaseMenuHandlers
): MenuItem[] {
  const items: MenuItem[] = []

  if (suggestions.length) {
    items.push({ label: t('contextMenu.Most Relevant'), isGroupLabel: true })
    for (const nodeDef of suggestions) {
      items.push({
        label: nodeDef.display_name,
        command: () => handlers.selectNode(nodeDef)
      })
    }
  }

  const { comfy, extensions, partner } = classifyNodes(compatibleNodes)
  const groups = [
    toNodeGroupItem(t('contextMenu.Comfy Nodes'), comfy, handlers.selectNode),
    toNodeGroupItem(
      t('contextMenu.Extensions'),
      extensions,
      handlers.selectNode
    ),
    toNodeGroupItem(
      t('contextMenu.Partner Nodes'),
      partner,
      handlers.selectNode
    )
  ].filter((g): g is MenuItem => g !== null)

  if (groups.length) {
    items.push({ separator: true }, ...groups)
  }

  return items
}

function buildSearchResultItems(
  searchResults: ComfyNodeDefImpl[],
  noResultsLabel: string,
  selectNode: (nodeDef: ComfyNodeDefImpl) => void
): MenuItem[] {
  if (!searchResults.length) {
    return [{ label: noResultsLabel, disabled: true }]
  }
  return searchResults.map((nodeDef) => ({
    label: nodeDef.display_name,
    command: () => selectNode(nodeDef)
  }))
}

export function buildLinkReleaseMenuItems({
  context,
  compatibleNodes,
  defaultNodeDefs,
  query,
  searchResults,
  t,
  handlers
}: LinkReleaseMenuModelOptions): MenuItem[] {
  const trimmedQuery = query.trim()

  const rerouteDef = defaultNodeDefs.find((d) => d.name === 'Reroute')
  const suggestions = defaultNodeDefs.filter((d) => d.name !== 'Reroute')

  const items: MenuItem[] = [
    {
      label: getLinkReleaseHeaderLabel(context),
      isHeader: true,
      disabled: true
    },
    { separator: true },
    { isSearch: true },
    { separator: true }
  ]

  if (trimmedQuery) {
    items.push(
      ...buildSearchResultItems(
        searchResults,
        t('g.noResults'),
        handlers.selectNode
      )
    )
  } else {
    items.push(
      ...buildDefaultMenuItems(suggestions, compatibleNodes, t, handlers)
    )
  }

  items.push({ separator: true })
  if (rerouteDef) {
    items.push({
      label: rerouteDef.display_name,
      command: () => handlers.selectNode(rerouteDef)
    })
  }
  items.push(buildAddRerouteItem(t, handlers))

  return items
}
