import { describe, expect, it } from 'vitest'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'

import type { ResolvedSelection } from '@/components/builder/useResolvedSelectedInputs'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputGroup } from '@comfyorg/graph-model/workflowSchema'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import {
  autoGroupName,
  groupPosition,
  isRenderableAppInput,
  resolveGroupItems
} from './useInputGroups'

const key = (name: string, node = 1): WidgetId =>
  widgetId('root', toNodeId(node), name)

function makeGroup(items: { key: WidgetId; pairId?: string }[]): InputGroup {
  return { id: 'g1', name: null, items }
}

function makeSelection(
  id: WidgetId,
  label?: string
): Extract<ResolvedSelection, { status: 'resolved' }> {
  const name = label?.toLowerCase() ?? 'widget'
  return {
    status: 'resolved',
    widgetId: id,
    node: new LGraphNode('Test'),
    widget: { name, label, type: 'number', value: 0, options: {}, y: 0 },
    displayName: name
  }
}

describe('autoGroupName', () => {
  it('joins current widget labels and falls back to display names', () => {
    const widthId = key('width')
    const heightId = key('height')
    const selections = [
      makeSelection(widthId, 'Width'),
      {
        status: 'unknown',
        widgetId: heightId,
        displayName: 'Height'
      } satisfies ResolvedSelection
    ]

    expect(
      autoGroupName(
        makeGroup([{ key: widthId }, { key: heightId }]),
        selections
      )
    ).toBe('Width, Height')
  })

  it('returns the untitled label when no selected input matches', () => {
    expect(autoGroupName(makeGroup([{ key: key('missing') }]), [])).toBe(
      'Untitled group'
    )
  })
})

describe('resolveGroupItems', () => {
  it('keeps only currently selected, resolved widgets', () => {
    const widthId = key('width')
    const unknownId = key('unknown')
    const staleId = key('stale')
    const group = makeGroup([
      { key: widthId, pairId: 'pair' },
      { key: unknownId },
      { key: staleId }
    ])
    const selections: ResolvedSelection[] = [
      makeSelection(widthId, 'Width'),
      { status: 'unknown', widgetId: unknownId, displayName: 'Unknown' }
    ]

    expect(resolveGroupItems(group, selections)).toEqual([
      { key: widthId, pairId: 'pair' }
    ])
  })
})

describe('groupPosition', () => {
  it.for([
    { index: 0, count: 1, expected: 'only' },
    { index: 0, count: 3, expected: 'first' },
    { index: 1, count: 3, expected: 'middle' },
    { index: 2, count: 3, expected: 'last' }
  ] as const)(
    'returns $expected for index $index of $count',
    ({ index, count, expected }) => {
      expect(groupPosition(index, count)).toBe(expected)
    }
  )
})

describe('isRenderableAppInput', () => {
  it('includes an unlinked input on an active node', () => {
    const selection = makeSelection(key('seed'), 'Seed')
    selection.node.mode = LGraphEventMode.ALWAYS
    expect(isRenderableAppInput(selection, () => false)).toBe(true)
  })

  it('excludes a selected input whose node is disabled', () => {
    const selection = makeSelection(key('seed'), 'Seed')
    selection.node.mode = LGraphEventMode.NEVER
    expect(isRenderableAppInput(selection, () => false)).toBe(false)
  })

  it('excludes a linked input with no renderable control', () => {
    const selection = makeSelection(key('seed'), 'Seed')
    selection.node.mode = LGraphEventMode.ALWAYS
    expect(isRenderableAppInput(selection, () => true)).toBe(false)
  })

  it('excludes unresolved input keys before checking graph links', () => {
    const selection: ResolvedSelection = {
      status: 'unknown',
      widgetId: key('missing'),
      displayName: 'Missing'
    }
    expect(isRenderableAppInput(selection, () => false)).toBe(false)
  })
})
