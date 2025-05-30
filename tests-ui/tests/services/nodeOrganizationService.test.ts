import { describe, expect, it } from 'vitest'

import { nodeOrganizationService } from '@/services/nodeOrganizationService'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'

describe('nodeOrganizationService', () => {
  const createMockNodeDef = (overrides: any = {}) => {
    const mockNodeDef = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'test/subcategory',
      python_module: 'custom_nodes.MyPackage.nodes',
      api_node: false,
      nodeSource: {
        type: NodeSourceType.CustomNodes,
        className: 'comfy-custom',
        displayText: 'Custom',
        badgeText: 'C'
      },
      ...overrides
    }

    Object.setPrototypeOf(mockNodeDef, ComfyNodeDefImpl.prototype)
    return mockNodeDef as ComfyNodeDefImpl
  }

  describe('getGroupingStrategies', () => {
    it('should return all grouping strategies', () => {
      const strategies = nodeOrganizationService.getGroupingStrategies()
      expect(strategies).toHaveLength(3)
      expect(strategies.map((s) => s.id)).toEqual([
        'category',
        'module',
        'source'
      ])
    })

    it('should return immutable copy', () => {
      const strategies1 = nodeOrganizationService.getGroupingStrategies()
      const strategies2 = nodeOrganizationService.getGroupingStrategies()
      expect(strategies1).not.toBe(strategies2)
      expect(strategies1).toEqual(strategies2)
    })
  })

  describe('getGroupingStrategy', () => {
    it('should return strategy by id', () => {
      const strategy = nodeOrganizationService.getGroupingStrategy('category')
      expect(strategy).toBeDefined()
      expect(strategy?.id).toBe('category')
    })

    it('should return undefined for unknown id', () => {
      const strategy = nodeOrganizationService.getGroupingStrategy('unknown')
      expect(strategy).toBeUndefined()
    })
  })

  describe('getSortingStrategies', () => {
    it('should return all sorting strategies', () => {
      const strategies = nodeOrganizationService.getSortingStrategies()
      expect(strategies).toHaveLength(2)
      expect(strategies.map((s) => s.id)).toEqual(['original', 'alphabetical'])
    })
  })

  describe('getSortingStrategy', () => {
    it('should return strategy by id', () => {
      const strategy =
        nodeOrganizationService.getSortingStrategy('alphabetical')
      expect(strategy).toBeDefined()
      expect(strategy?.id).toBe('alphabetical')
    })

    it('should return undefined for unknown id', () => {
      const strategy = nodeOrganizationService.getSortingStrategy('unknown')
      expect(strategy).toBeUndefined()
    })
  })

  describe('organizeNodes', () => {
    const mockNodes = [
      createMockNodeDef({ name: 'NodeA', display_name: 'Zebra Node' }),
      createMockNodeDef({ name: 'NodeB', display_name: 'Apple Node' })
    ]

    it('should organize nodes with default options', () => {
      const tree = nodeOrganizationService.organizeNodes(mockNodes)
      expect(tree).toBeDefined()
      expect(tree.children).toBeDefined()
    })

    it('should organize nodes with custom grouping', () => {
      const tree = nodeOrganizationService.organizeNodes(mockNodes, {
        groupBy: 'module'
      })
      expect(tree).toBeDefined()
      expect(tree.children).toBeDefined()
    })

    it('should organize nodes with custom sorting', () => {
      const tree = nodeOrganizationService.organizeNodes(mockNodes, {
        sortBy: 'alphabetical'
      })
      expect(tree).toBeDefined()
      expect(tree.children).toBeDefined()
    })

    it('should throw error for unknown grouping strategy', () => {
      expect(() => {
        nodeOrganizationService.organizeNodes(mockNodes, {
          groupBy: 'unknown'
        })
      }).toThrow('Unknown grouping strategy: unknown')
    })

    it('should throw error for unknown sorting strategy', () => {
      expect(() => {
        nodeOrganizationService.organizeNodes(mockNodes, {
          sortBy: 'unknown'
        })
      }).toThrow('Unknown sorting strategy: unknown')
    })
  })

  describe('getGroupingIcon', () => {
    it('should return strategy icon', () => {
      const icon = nodeOrganizationService.getGroupingIcon('category')
      expect(icon).toBe('pi pi-sitemap')
    })

    it('should return fallback icon for unknown strategy', () => {
      const icon = nodeOrganizationService.getGroupingIcon('unknown')
      expect(icon).toBe('pi pi-sort-alt')
    })
  })

  describe('getSortingIcon', () => {
    it('should return strategy icon', () => {
      const icon = nodeOrganizationService.getSortingIcon('alphabetical')
      expect(icon).toBe('pi pi-sort-alpha-down')
    })

    it('should return fallback icon for unknown strategy', () => {
      const icon = nodeOrganizationService.getSortingIcon('unknown')
      expect(icon).toBe('pi pi-sort-alt')
    })
  })

  describe('grouping path extraction', () => {
    const mockNodeDef = createMockNodeDef()

    it('category grouping should use category path', () => {
      const strategy = nodeOrganizationService.getGroupingStrategy('category')
      const path = strategy?.getNodePath(mockNodeDef)
      expect(path).toEqual(['test', 'subcategory', 'TestNode'])
    })

    it('module grouping should extract module path', () => {
      const strategy = nodeOrganizationService.getGroupingStrategy('module')
      const path = strategy?.getNodePath(mockNodeDef)
      expect(path).toEqual(['MyPackage', 'TestNode'])
    })

    it('source grouping should categorize by source type', () => {
      const strategy = nodeOrganizationService.getGroupingStrategy('source')
      const path = strategy?.getNodePath(mockNodeDef)
      expect(path).toEqual(['custom_nodes', 'TestNode'])
    })
  })

  describe('sorting comparison', () => {
    it('original sort should keep order', () => {
      const strategy = nodeOrganizationService.getSortingStrategy('original')
      const nodeA = createMockNodeDef({ display_name: 'Zebra' })
      const nodeB = createMockNodeDef({ display_name: 'Apple' })

      expect(strategy?.compare(nodeA, nodeB)).toBe(0)
    })

    it('alphabetical sort should compare display names', () => {
      const strategy =
        nodeOrganizationService.getSortingStrategy('alphabetical')
      const nodeA = createMockNodeDef({ display_name: 'Zebra' })
      const nodeB = createMockNodeDef({ display_name: 'Apple' })

      expect(strategy?.compare(nodeA, nodeB)).toBeGreaterThan(0)
      expect(strategy?.compare(nodeB, nodeA)).toBeLessThan(0)
    })
  })
})
