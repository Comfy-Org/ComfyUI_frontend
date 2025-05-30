import { ComfyNodeDefImpl, buildNodeDefTree } from '@/stores/nodeDefStore'
import type {
  NodeGroupingStrategy,
  NodeOrganizationOptions,
  NodeSortStrategy
} from '@/types/nodeOrganizationTypes'
import { NodeSourceType } from '@/types/nodeSource'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { sortedTree } from '@/utils/treeUtil'

const DEFAULT_ICON = 'pi pi-sort'

export const DEFAULT_GROUPING_ID = 'category' as const
export const DEFAULT_SORTING_ID = 'original' as const

export class NodeOrganizationService {
  private readonly groupingStrategies: NodeGroupingStrategy[] = [
    {
      id: 'category',
      label: 'sideToolbar.nodeLibraryTab.groupStrategies.category',
      icon: 'pi pi-folder',
      description: 'sideToolbar.nodeLibraryTab.groupStrategies.categoryDesc',
      getNodePath: (nodeDef: ComfyNodeDefImpl) => {
        const category = nodeDef.category || ''
        const categoryParts = category ? category.split('/') : []
        return [...categoryParts, nodeDef.name]
      }
    },
    {
      id: 'module',
      label: 'sideToolbar.nodeLibraryTab.groupStrategies.module',
      icon: 'pi pi-box',
      description: 'sideToolbar.nodeLibraryTab.groupStrategies.moduleDesc',
      getNodePath: (nodeDef: ComfyNodeDefImpl) => {
        const pythonModule = nodeDef.python_module || ''

        if (!pythonModule) {
          return ['unknown_module', nodeDef.name]
        }

        // Split the module path into components
        const parts = pythonModule.split('.')

        // Remove common prefixes and organize
        if (parts[0] === 'nodes') {
          // Core nodes - just use 'core'
          return ['core', nodeDef.name]
        } else if (parts[0] === 'custom_nodes') {
          // Custom nodes - use the package name as the folder
          if (parts.length > 1) {
            // Return the custom node package name
            return [parts[1], nodeDef.name]
          }
          return ['custom_nodes', nodeDef.name]
        }

        // For other modules, use the full path structure plus node name
        return [...parts, nodeDef.name]
      }
    },
    {
      id: 'source',
      label: 'sideToolbar.nodeLibraryTab.groupStrategies.source',
      icon: 'pi pi-server',
      description: 'sideToolbar.nodeLibraryTab.groupStrategies.sourceDesc',
      getNodePath: (nodeDef: ComfyNodeDefImpl) => {
        if (nodeDef.api_node) {
          return ['API nodes', nodeDef.name]
        } else if (nodeDef.nodeSource.type === NodeSourceType.Core) {
          return ['Core', nodeDef.name]
        } else if (nodeDef.nodeSource.type === NodeSourceType.CustomNodes) {
          return ['Custom nodes', nodeDef.name]
        } else {
          return ['Unknown', nodeDef.name]
        }
      }
    }
  ]

  private readonly sortingStrategies: NodeSortStrategy[] = [
    {
      id: 'original',
      label: 'sideToolbar.nodeLibraryTab.sortBy.original',
      icon: 'pi pi-sort-alt',
      description: 'sideToolbar.nodeLibraryTab.sortBy.originalDesc',
      compare: () => 0
    },
    {
      id: 'alphabetical',
      label: 'sideToolbar.nodeLibraryTab.sortBy.alphabetical',
      icon: 'pi pi-sort-alpha-down',
      description: 'sideToolbar.nodeLibraryTab.sortBy.alphabeticalDesc',
      compare: (a: ComfyNodeDefImpl, b: ComfyNodeDefImpl) =>
        (a.display_name ?? '').localeCompare(b.display_name ?? '')
    }
  ]

  getGroupingStrategies(): NodeGroupingStrategy[] {
    return [...this.groupingStrategies]
  }

  getGroupingStrategy(id: string): NodeGroupingStrategy | undefined {
    return this.groupingStrategies.find((strategy) => strategy.id === id)
  }

  getSortingStrategies(): NodeSortStrategy[] {
    return [...this.sortingStrategies]
  }

  getSortingStrategy(id: string): NodeSortStrategy | undefined {
    return this.sortingStrategies.find((strategy) => strategy.id === id)
  }

  organizeNodes(
    nodes: ComfyNodeDefImpl[],
    options: NodeOrganizationOptions = {}
  ): TreeNode {
    const { groupBy = DEFAULT_GROUPING_ID, sortBy = DEFAULT_SORTING_ID } =
      options

    const groupingStrategy = this.getGroupingStrategy(groupBy)
    const sortingStrategy = this.getSortingStrategy(sortBy)

    if (!groupingStrategy) {
      throw new Error(`Unknown grouping strategy: ${groupBy}`)
    }

    if (!sortingStrategy) {
      throw new Error(`Unknown sorting strategy: ${sortBy}`)
    }

    const sortedNodes =
      sortingStrategy.id !== 'original'
        ? [...nodes].sort(sortingStrategy.compare)
        : nodes

    const tree = buildNodeDefTree(sortedNodes, {
      pathExtractor: groupingStrategy.getNodePath
    })

    if (sortBy === 'alphabetical') {
      return sortedTree(tree, { groupLeaf: true })
    }

    return tree
  }

  getGroupingIcon(groupingId: string): string {
    const strategy = this.getGroupingStrategy(groupingId)
    return strategy?.icon || DEFAULT_ICON
  }

  getSortingIcon(sortingId: string): string {
    const strategy = this.getSortingStrategy(sortingId)
    return strategy?.icon || DEFAULT_ICON
  }
}

export const nodeOrganizationService = new NodeOrganizationService()
