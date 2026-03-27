import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputGroup } from '@/platform/workflow/management/stores/comfyWorkflow'

const mockResolveNodeWidget =
  vi.fn<(...args: unknown[]) => [LGraphNode, IBaseWidget] | [LGraphNode] | []>()

vi.mock('@/utils/litegraphUtil', () => ({
  resolveNodeWidget: (...args: unknown[]) => mockResolveNodeWidget(...args)
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

import {
  autoGroupName,
  groupedByPair,
  resolveGroupItems
} from './useInputGroups'

beforeEach(() => {
  vi.clearAllMocks()
})

function makeNode(id: string): LGraphNode {
  return { id } as unknown as LGraphNode
}

function makeWidget(name: string, label?: string): IBaseWidget {
  return { name, label } as unknown as IBaseWidget
}

function makeGroup(items: { key: string; pairId?: string }[]): InputGroup {
  return { id: 'g1', name: null, items }
}

function makeResolvedItem(key: string, opts: { pairId?: string } = {}) {
  return {
    key,
    pairId: opts.pairId,
    node: makeNode('1'),
    widget: makeWidget('w'),
    nodeId: '1',
    widgetName: 'w'
  }
}

describe('groupedByPair', () => {
  it('returns empty for empty input', () => {
    expect(groupedByPair([])).toEqual([])
  })

  it('treats all items without pairId as singles', () => {
    const items = [makeResolvedItem('a'), makeResolvedItem('b')]
    const rows = groupedByPair(items)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ type: 'single' })
    expect(rows[1]).toMatchObject({ type: 'single' })
  })

  it('pairs two items with matching pairId', () => {
    const items = [
      makeResolvedItem('a', { pairId: 'p1' }),
      makeResolvedItem('b', { pairId: 'p1' })
    ]
    const rows = groupedByPair(items)

    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('pair')
    if (rows[0].type === 'pair') {
      expect(rows[0].items[0].key).toBe('a')
      expect(rows[0].items[1].key).toBe('b')
    }
  })

  it('renders orphaned pairId (no partner) as single', () => {
    const items = [makeResolvedItem('a', { pairId: 'lonely' })]
    const rows = groupedByPair(items)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'single' })
  })

  it('handles mixed singles and pairs', () => {
    const items = [
      makeResolvedItem('a'),
      makeResolvedItem('b', { pairId: 'p1' }),
      makeResolvedItem('c', { pairId: 'p1' }),
      makeResolvedItem('d')
    ]
    const rows = groupedByPair(items)

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ type: 'single' })
    expect(rows[1]).toMatchObject({ type: 'pair' })
    expect(rows[2]).toMatchObject({ type: 'single' })
  })

  it('pairs first two of three items with same pairId, third becomes single', () => {
    const items = [
      makeResolvedItem('a', { pairId: 'p1' }),
      makeResolvedItem('b', { pairId: 'p1' }),
      makeResolvedItem('c', { pairId: 'p1' })
    ]
    const rows = groupedByPair(items)

    expect(rows).toHaveLength(2)
    expect(rows[0].type).toBe('pair')
    expect(rows[1]).toMatchObject({ type: 'single' })
  })
})

describe('autoGroupName', () => {
  it('joins widget labels with comma', () => {
    mockResolveNodeWidget
      .mockReturnValueOnce([makeNode('1'), makeWidget('w1', 'Width')])
      .mockReturnValueOnce([makeNode('2'), makeWidget('w2', 'Height')])

    const group = makeGroup([{ key: 'input:1:w1' }, { key: 'input:2:w2' }])

    expect(autoGroupName(group)).toBe('Width, Height')
  })

  it('falls back to widget name when label is absent', () => {
    mockResolveNodeWidget.mockReturnValueOnce([
      makeNode('1'),
      makeWidget('steps')
    ])

    const group = makeGroup([{ key: 'input:1:steps' }])
    expect(autoGroupName(group)).toBe('steps')
  })

  it('returns untitled key when no widgets resolve', () => {
    mockResolveNodeWidget.mockReturnValue([])

    const group = makeGroup([{ key: 'input:1:w' }])
    expect(autoGroupName(group)).toBe('linearMode.groups.untitled')
  })

  it('skips non-input keys', () => {
    mockResolveNodeWidget.mockReturnValueOnce([
      makeNode('1'),
      makeWidget('w', 'OK')
    ])

    const group = makeGroup([{ key: 'output:1:w' }, { key: 'input:1:w' }])

    expect(autoGroupName(group)).toBe('OK')
    expect(mockResolveNodeWidget).toHaveBeenCalledTimes(1)
  })
})

describe('resolveGroupItems', () => {
  it('filters out items where resolveNodeWidget returns empty', () => {
    mockResolveNodeWidget
      .mockReturnValueOnce([makeNode('1'), makeWidget('w1')])
      .mockReturnValueOnce([])

    const group = makeGroup([{ key: 'input:1:w1' }, { key: 'input:2:missing' }])
    const resolved = resolveGroupItems(group)

    expect(resolved).toHaveLength(1)
    expect(resolved[0].widgetName).toBe('w1')
  })

  it('handles widget names containing colons', () => {
    mockResolveNodeWidget.mockReturnValueOnce([
      makeNode('5'),
      makeWidget('a:b:c')
    ])

    const group = makeGroup([{ key: 'input:5:a:b:c' }])
    const resolved = resolveGroupItems(group)

    expect(resolved).toHaveLength(1)
    expect(resolved[0].nodeId).toBe('5')
    expect(resolved[0].widgetName).toBe('a:b:c')
  })

  it('skips non-input keys', () => {
    const group = makeGroup([{ key: 'other:1:w' }])
    const resolved = resolveGroupItems(group)

    expect(resolved).toHaveLength(0)
    expect(mockResolveNodeWidget).not.toHaveBeenCalled()
  })

  it('preserves pairId on resolved items', () => {
    mockResolveNodeWidget.mockReturnValueOnce([makeNode('1'), makeWidget('w')])

    const group = makeGroup([{ key: 'input:1:w', pairId: 'p1' }])
    const resolved = resolveGroupItems(group)

    expect(resolved[0].pairId).toBe('p1')
  })
})
