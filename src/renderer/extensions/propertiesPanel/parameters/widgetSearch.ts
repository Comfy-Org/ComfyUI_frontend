import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { NodeWidgetsListList } from './widgetSections'

interface WidgetSearchItem {
  index: number
  searchableLabel: string
  searchableName: string
  searchableType: string
  searchableValue: string
}

/**
 * Searches widgets in a list using fuzzy search and returns search results.
 * Uses Fuse.js for better matching with typo tolerance and relevance ranking.
 * Filters by name, localized label, type, and user-input value.
 */
export function searchWidgets<T extends { widget: IBaseWidget }[]>(
  list: T,
  query: string
): T {
  if (query.trim() === '') {
    return list
  }

  const searchableList: WidgetSearchItem[] = list.map((item, index) => {
    const searchableItem = {
      index,
      searchableLabel: item.widget.label?.toLowerCase() || '',
      searchableName: item.widget.name.toLowerCase(),
      searchableType:
        typeof item.widget.type === 'string'
          ? item.widget.type.toLowerCase()
          : '',
      searchableValue: item.widget.value?.toString().toLowerCase() || ''
    }
    return searchableItem
  })

  const fuseOptions: IFuseOptions<WidgetSearchItem> = {
    keys: [
      { name: 'searchableName', weight: 0.4 },
      { name: 'searchableLabel', weight: 0.3 },
      { name: 'searchableValue', weight: 0.3 },
      { name: 'searchableType', weight: 0.2 }
    ],
    threshold: 0.3
  }

  const fuse = new Fuse(searchableList, fuseOptions)
  const results = fuse.search(query.trim())

  const matchedItems = new Set(results.map((result) => list[result.item.index]))

  return list.filter((item) => matchedItems.has(item)) as T
}

type NodeSearchItem = {
  nodeId: NodeId
  searchableTitle: string
}

/**
 * Searches widgets and nodes in a list using fuzzy search and returns search results.
 * Uses Fuse.js for node title matching with typo tolerance and relevance ranking.
 * First checks if the node title matches the query (if so, keeps entire node).
 * Otherwise, filters widgets using searchWidgets.
 */
export function searchWidgetsAndNodes(
  list: NodeWidgetsListList,
  query: string
): NodeWidgetsListList {
  if (query.trim() === '') {
    return list
  }

  const searchableList: NodeSearchItem[] = list.map((item) => ({
    nodeId: item.node.id,
    searchableTitle: (item.node.getTitle() ?? item.node.type).toLowerCase()
  }))

  const fuseOptions: IFuseOptions<NodeSearchItem> = {
    keys: [{ name: 'searchableTitle', weight: 1.0 }],
    threshold: 0.3
  }

  const fuse = new Fuse(searchableList, fuseOptions)
  const nodeMatches = fuse.search(query.trim())
  const matchedNodeIds = new Set(
    nodeMatches.map((result) => result.item.nodeId)
  )

  return list.flatMap((item) => {
    if (matchedNodeIds.has(item.node.id)) {
      return [item]
    }

    const widgets = searchWidgets(item.widgets, query)
    return widgets.length > 0 ? [{ ...item, widgets }] : []
  })
}
