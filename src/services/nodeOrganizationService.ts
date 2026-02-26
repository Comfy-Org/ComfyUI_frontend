import type { EssentialsCategory } from '@/constants/essentialsNodes'
import {
  ESSENTIALS_NODES
} from '@/constants/essentialsNodes'
import { t } from '@/i18n'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { buildNodeDefTree } from '@/stores/nodeDefStore'
import type {
  NodeGroupingStrategy,
  NodeOrganizationOptions,
  NodeSection,
  NodeSortStrategy,
  TabId
} from '@/types/nodeOrganizationTypes'
import { NodeSourceType } from '@/types/nodeSource'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { sortedTree, unwrapTreeRoot } from '@/utils/treeUtil'

const DEFAULT_ICON = 'pi pi-sort'

export const DEFAULT_GROUPING_ID = 'category' as const
export const DEFAULT_SORTING_ID = 'original' as const
export const DEFAULT_TAB_ID = 'all' as const

class NodeOrganizationService {
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

  organizeNodesByTab(
    nodes: ComfyNodeDefImpl[],
    tabId: TabId = DEFAULT_TAB_ID
  ): NodeSection[] {
    const categoryPathExtractor = (nodeDef: ComfyNodeDefImpl) => {
      const category = nodeDef.category || ''
      const categoryParts = category ? category.split('/') : []
      return [...categoryParts, nodeDef.name]
    }

    switch (tabId) {
      case 'essentials': {
        const essentialNodes = nodes.filter(
          (nodeDef) => !!nodeDef.essentials_category
        )
        const essentialsPathExtractor = (nodeDef: ComfyNodeDefImpl) => {
          const folder = nodeDef.essentials_category || ''
          return folder ? [folder, nodeDef.name] : [nodeDef.name]
        }
        const tree = buildNodeDefTree(essentialNodes, {
          pathExtractor: essentialsPathExtractor
        })
        if (tree.children) {
          for (const folder of tree.children) {
            if (!folder.children) continue
            const order = ESSENTIALS_NODES[folder.label as EssentialsCategory]
            if (!order) continue
            const nodeOrder: readonly string[] = order
            const orderLen = nodeOrder.length
            folder.children.sort((a, b) => {
              const nameA = a.data?.name ?? a.label ?? ''
              const nameB = b.data?.name ?? b.label ?? ''
              const ai = nodeOrder.indexOf(nameA)
              const bi = nodeOrder.indexOf(nameB)
              const orderA = ai === -1 ? orderLen : ai
              const orderB = bi === -1 ? orderLen : bi
              return orderA - orderB
            })
          }
        }
        return [{ tree }]
      }
      case 'blueprints': {
        const myBlueprints: ComfyNodeDefImpl[] = []
        const comfyBlueprints: ComfyNodeDefImpl[] = []
        for (const nodeDef of nodes) {
          if (
            nodeDef.nodeSource.type !== NodeSourceType.Blueprint &&
            !nodeDef.python_module?.startsWith('blueprint')
          )
            continue
          if (nodeDef.isGlobal) {
            comfyBlueprints.push(nodeDef)
          } else {
            myBlueprints.push(nodeDef)
          }
        }
        return [
          {
            title: 'sideToolbar.nodeLibraryTab.sections.myBlueprints',
            tree: unwrapTreeRoot(
              buildNodeDefTree(myBlueprints, {
                pathExtractor: categoryPathExtractor
              })
            )
          },
          {
            title: 'sideToolbar.nodeLibraryTab.sections.comfyBlueprints',
            tree: unwrapTreeRoot(
              buildNodeDefTree(comfyBlueprints, {
                pathExtractor: categoryPathExtractor
              })
            )
          }
        ]
      }
      case 'all':
      default: {
        const myBlueprints: ComfyNodeDefImpl[] = []
        const comfyBlueprints: ComfyNodeDefImpl[] = []
        const partnerNodes: ComfyNodeDefImpl[] = []
        const comfyNodes: ComfyNodeDefImpl[] = []
        const extensions: ComfyNodeDefImpl[] = []

        for (const node of nodes) {
          if (
            node.nodeSource.type === NodeSourceType.Blueprint ||
            node.python_module?.startsWith('blueprint')
          ) {
            if (node.isGlobal) {
              comfyBlueprints.push(node)
            } else {
              myBlueprints.push(node)
            }
          } else if (node.api_node || node.category?.startsWith('api node')) {
            partnerNodes.push(node)
          } else if (
            node.nodeSource.type === NodeSourceType.Core ||
            node.nodeSource.type === NodeSourceType.Essentials
          ) {
            comfyNodes.push(node)
          } else {
            extensions.push(node)
          }
        }

        const blueprintTree = this.buildBlueprintTree(
          myBlueprints,
          comfyBlueprints,
          categoryPathExtractor
        )

        const sections: NodeSection[] = []

        if (blueprintTree.children?.length) {
          sections.push({ category: 'blueprints', tree: blueprintTree })
        }
        if (partnerNodes.length > 0) {
          sections.push({
            category: 'partnerNodes',
            tree: unwrapTreeRoot(
              buildNodeDefTree(partnerNodes, {
                pathExtractor: categoryPathExtractor
              })
            )
          })
        }
        if (comfyNodes.length > 0) {
          sections.push({
            category: 'comfyNodes',
            tree: buildNodeDefTree(comfyNodes, {
              pathExtractor: categoryPathExtractor
            })
          })
        }
        if (extensions.length > 0) {
          sections.push({
            category: 'extensions',
            tree: buildNodeDefTree(extensions, {
              pathExtractor: categoryPathExtractor
            })
          })
        }

        return sections
      }
    }
  }

  private buildBlueprintTree(
    myBlueprints: ComfyNodeDefImpl[],
    comfyBlueprints: ComfyNodeDefImpl[],
    pathExtractor: (nodeDef: ComfyNodeDefImpl) => string[]
  ): TreeNode {
    const children: TreeNode[] = []
    if (myBlueprints.length > 0) {
      const tree = unwrapTreeRoot(
        buildNodeDefTree(myBlueprints, { pathExtractor })
      )
      children.push({
        key: 'root/my-blueprints',
        label: t('sideToolbar.nodeLibraryTab.sections.myBlueprints'),
        children: tree.children
      })
    }
    if (comfyBlueprints.length > 0) {
      const tree = unwrapTreeRoot(
        buildNodeDefTree(comfyBlueprints, { pathExtractor })
      )
      children.push({
        key: 'root/comfy-blueprints',
        label: t('sideToolbar.nodeLibraryTab.sections.comfyBlueprints'),
        children: tree.children
      })
    }
    return { key: 'root', label: '', children }
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
      sortingStrategy.id === 'original'
        ? nodes
        : [...nodes].sort(sortingStrategy.compare)

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
