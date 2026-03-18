import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { TreeNode } from '@/types/treeExplorerTypes'

export type GroupingStrategyId = 'category' | 'module' | 'source'
export type SortingStrategyId = 'original' | 'alphabetical'
export type TabId = 'essentials' | 'all' | 'blueprints'

/**
 * Strategy for grouping nodes into tree structure
 */
export interface NodeGroupingStrategy {
  /** Unique identifier for the grouping strategy */
  id: string
  /** Display name for UI (i18n key) */
  label: string
  /** Icon class for the grouping option */
  icon: string
  /** Description for tooltips (i18n key) */
  description?: string
  /** Function to extract the tree path from a node definition */
  getNodePath: (nodeDef: ComfyNodeDefImpl) => string[]
}

/**
 * Strategy for sorting nodes within groups
 */
export interface NodeSortStrategy {
  /** Unique identifier for the sort strategy */
  id: string
  /** Display name for UI (i18n key) */
  label: string
  /** Icon class for the sort option */
  icon: string
  /** Description for tooltips (i18n key) */
  description?: string
  /** Compare function for sorting nodes within the same group */
  compare: (a: ComfyNodeDefImpl, b: ComfyNodeDefImpl) => number
}

/**
 * Options for organizing nodes
 */
export interface NodeOrganizationOptions {
  groupBy?: string
  sortBy?: string
}

export type NodeCategoryId =
  | 'blueprints'
  | 'partnerNodes'
  | 'comfyNodes'
  | 'extensions'

export const NODE_CATEGORY_LABELS: Record<NodeCategoryId, string> = {
  blueprints: 'sideToolbar.nodeLibraryTab.sections.subgraphBlueprints',
  partnerNodes: 'sideToolbar.nodeLibraryTab.sections.partnerNodes',
  comfyNodes: 'sideToolbar.nodeLibraryTab.sections.comfyNodes',
  extensions: 'sideToolbar.nodeLibraryTab.sections.extensions'
}

export interface NodeSection {
  /** Filter category identifier */
  category?: NodeCategoryId
  /** Section title (i18n key) for tabs that don't use category-based labels */
  title?: string
  /** Tree of nodes in this section */
  tree: TreeNode
}
