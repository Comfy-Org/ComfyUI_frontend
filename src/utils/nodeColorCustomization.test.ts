import { describe, expect, it } from 'vitest'

import { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  applyCustomColorToItem,
  getSharedAppliedColor,
  getSharedCustomColor,
  toggleFavoriteNodeColor,
  upsertRecentNodeColor
} from './nodeColorCustomization'

describe('nodeColorCustomization', () => {
  it('applies a custom color to nodes using a derived header color', () => {
    const node = Object.assign(Object.create(LGraphNode.prototype), {
      color: undefined,
      bgcolor: undefined,
      getColorOption: () => null
    }) as LGraphNode

    const applied = applyCustomColorToItem(node, '#abcdef', {
      darkerHeader: true
    })

    expect(applied).toBe('#abcdef')
    expect(node.bgcolor).toBe('#abcdef')
    expect(node.color).not.toBe('#abcdef')
  })

  it('applies a custom color to groups without deriving a header color', () => {
    const group = Object.assign(Object.create(LGraphGroup.prototype), {
      color: undefined,
      getColorOption: () => null
    }) as LGraphGroup

    const applied = applyCustomColorToItem(group, '#123456', {
      darkerHeader: true
    })

    expect(applied).toBe('#123456')
    expect(group.color).toBe('#123456')
  })

  it('returns a shared applied color for matching custom node colors', () => {
    const nodeA = Object.assign(Object.create(LGraphNode.prototype), {
      bgcolor: '#abcdef',
      getColorOption: () => null
    }) as LGraphNode
    const nodeB = Object.assign(Object.create(LGraphNode.prototype), {
      bgcolor: '#abcdef',
      getColorOption: () => null
    }) as LGraphNode

    expect(getSharedAppliedColor([nodeA, nodeB])).toBe('#abcdef')
    expect(getSharedCustomColor([nodeA, nodeB])).toBe('#abcdef')
  })

  it('returns null when selected items do not share the same color', () => {
    const nodeA = Object.assign(Object.create(LGraphNode.prototype), {
      bgcolor: '#abcdef',
      getColorOption: () => null
    }) as LGraphNode
    const nodeB = Object.assign(Object.create(LGraphNode.prototype), {
      bgcolor: '#123456',
      getColorOption: () => null
    }) as LGraphNode

    expect(getSharedAppliedColor([nodeA, nodeB])).toBeNull()
    expect(getSharedCustomColor([nodeA, nodeB])).toBeNull()
  })

  it('keeps recent colors unique and most-recent-first', () => {
    const updated = upsertRecentNodeColor(
      ['#111111', '#222222', '#333333'],
      '#222222'
    )

    expect(updated).toEqual(['#222222', '#111111', '#333333'])
  })

  it('toggles favorite colors on and off', () => {
    const added = toggleFavoriteNodeColor(['#111111'], '#222222')
    const removed = toggleFavoriteNodeColor(added, '#111111')

    expect(added).toEqual(['#111111', '#222222'])
    expect(removed).toEqual(['#222222'])
  })
})
