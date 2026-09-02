import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import type { PackNode } from '../data/cloudNodes'

import { useNodesByCategory } from './useNodesByCategory'

function node(name: string, displayName: string, category: string): PackNode {
  return { name, displayName, category }
}

describe('useNodesByCategory', () => {
  it('groups nodes by category', () => {
    const { groupedNodes } = useNodesByCategory(() => [
      node('A', 'A', 'cat-1'),
      node('B', 'B', 'cat-2'),
      node('C', 'C', 'cat-1')
    ])
    expect(groupedNodes.value).toHaveLength(2)
    expect(groupedNodes.value[0]).toMatchObject({
      category: 'cat-1',
      nodes: [
        expect.objectContaining({ name: 'A' }),
        expect.objectContaining({ name: 'C' })
      ]
    })
  })

  it('sorts nodes alphabetically by display name within a category', () => {
    const { groupedNodes } = useNodesByCategory(() => [
      node('z', 'Zulu', 'x'),
      node('a', 'Alpha', 'x'),
      node('m', 'Mike', 'x')
    ])
    expect(groupedNodes.value[0].nodes.map((n) => n.displayName)).toEqual([
      'Alpha',
      'Mike',
      'Zulu'
    ])
  })

  it('sorts categories alphabetically', () => {
    const { groupedNodes } = useNodesByCategory(() => [
      node('a', 'A', 'beta'),
      node('b', 'B', 'alpha'),
      node('c', 'C', 'gamma')
    ])
    expect(groupedNodes.value.map((g) => g.category)).toEqual([
      'alpha',
      'beta',
      'gamma'
    ])
  })

  it('falls back to a placeholder for missing categories', () => {
    const { groupedNodes } = useNodesByCategory(() => [node('a', 'A', '')])
    expect(groupedNodes.value[0].category).toBe('—')
  })

  it('reacts to ref changes', () => {
    const nodes = ref<PackNode[]>([node('a', 'A', 'x')])
    const { groupedNodes } = useNodesByCategory(nodes)
    expect(groupedNodes.value).toHaveLength(1)

    nodes.value = [node('a', 'A', 'x'), node('b', 'B', 'y')]
    expect(groupedNodes.value).toHaveLength(2)
  })
})
