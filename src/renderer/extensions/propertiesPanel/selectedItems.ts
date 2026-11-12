import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { isLGraphGroup, isLGraphNode } from '@/utils/litegraphUtil'
import type { Positionable } from '@comfyorg/graph-model/interfaces'

type MixedSelectionItem = LGraphGroup | LGraphNode
type FlatAndCategorizeSelectedItemsResult = {
  all: MixedSelectionItem[]
  nodes: LGraphNode[]
  groups: LGraphGroup[]
  others: Positionable[]
  nodeToParentGroup: Map<LGraphNode, LGraphGroup>
}

type FlatItemsContext = {
  nodeToParentGroup: Map<LGraphNode, LGraphGroup>
  depth: number
  parentGroup?: LGraphGroup
}

/** Flattens selected groups into their contents and splits the result into nodes, groups, and unsupported items. */
export function flatAndCategorizeSelectedItems(
  items: Positionable[]
): FlatAndCategorizeSelectedItemsResult {
  const ctx: FlatItemsContext = {
    nodeToParentGroup: new Map<LGraphNode, LGraphGroup>(),
    depth: 0
  }
  const { all, nodes, groups, others } = flatItems(items, ctx)
  return {
    all: repeatItems(all),
    nodes: repeatItems(nodes),
    groups: repeatItems(groups),
    others: repeatItems(others),
    nodeToParentGroup: ctx.nodeToParentGroup
  }
}

export function useFlatAndCategorizeSelectedItems(
  items: MaybeRefOrGetter<Positionable[]>
) {
  const result = computed(() => flatAndCategorizeSelectedItems(toValue(items)))

  return {
    flattedItems: computed(() => result.value.all),
    selectedNodes: computed(() => result.value.nodes),
    selectedGroups: computed(() => result.value.groups),
    selectedOthers: computed(() => result.value.others),
    nodeToParentGroup: computed(() => result.value.nodeToParentGroup)
  }
}

function flatItems(
  items: Positionable[],
  ctx: FlatItemsContext
): Omit<FlatAndCategorizeSelectedItemsResult, 'nodeToParentGroup'> {
  const result: MixedSelectionItem[] = []
  const nodes: LGraphNode[] = []
  const groups: LGraphGroup[] = []
  const others: Positionable[] = []

  if (ctx.depth > 1000) {
    return {
      all: [],
      nodes: [],
      groups: [],
      others: []
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    if (isLGraphGroup(item)) {
      result.push(item)
      groups.push(item)

      const children = Array.from(item.children)
      const childCtx: FlatItemsContext = {
        nodeToParentGroup: ctx.nodeToParentGroup,
        depth: ctx.depth + 1,
        parentGroup: item
      }
      const {
        all: childAll,
        nodes: childNodes,
        groups: childGroups,
        others: childOthers
      } = flatItems(children, childCtx)
      result.push(...childAll)
      nodes.push(...childNodes)
      groups.push(...childGroups)
      others.push(...childOthers)
    } else if (isLGraphNode(item)) {
      result.push(item)
      nodes.push(item)
      if (ctx.parentGroup) {
        ctx.nodeToParentGroup.set(item, ctx.parentGroup)
      }
    } else {
      others.push(item)
    }
  }
  return {
    all: result,
    nodes,
    groups,
    others
  }
}

function repeatItems<T>(items: T[]): T[] {
  const itemSet = new Set<T>()
  const result: T[] = []
  for (const item of items) {
    if (itemSet.has(item)) continue
    itemSet.add(item)
    result.push(item)
  }
  return result
}
