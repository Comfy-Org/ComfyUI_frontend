import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'

import {
  collectPendingLocalEdits,
  docReflects,
  widgetKey
} from './pendingLocalEdits'

const ACTOR = 'human:test:tab-1'
const CATALOG: WidgetCatalog = {
  types: {
    Source: { widget_order: ['steps'] },
    Sink: { widget_order: [] }
  }
}

let stampSeq = 0
const base = (opId: string) => ({
  op_id: opId,
  actor: ACTOR,
  base_version: 1,
  stamp: [++stampSeq, ACTOR] as [number, string]
})

const deleteNode = (nodeId: string): Op => ({
  ...base(`delete-${nodeId}`),
  op: 'delete_node',
  node_id: nodeId,
  removed_links: []
})
const setWidget = (
  nodeId: string,
  value: unknown,
  path?: [string, ...string[]]
): Op =>
  path
    ? {
        ...base(`set-${nodeId}-${String(value)}-interior`),
        op: 'set_widget',
        node_id: nodeId,
        widget: 'steps',
        value,
        path,
        inner_widget: 'steps'
      }
    : {
        ...base(`set-${nodeId}-${String(value)}`),
        op: 'set_widget',
        node_id: nodeId,
        widget: 'steps',
        value
      }
const connect = (linkId: number): Op => ({
  ...base(`connect-${linkId}`),
  op: 'connect',
  link_id: linkId,
  from_node: '1',
  from_slot: 0,
  to_node: '2',
  to_slot: 0,
  link_type: 'IMAGE'
})
const disconnect = (linkId: number): Op => ({
  ...base(`disconnect-${linkId}`),
  op: 'disconnect',
  link_id: linkId,
  to_node: '2',
  to_slot: 0
})
const addNode = (nodeId: string): Op => ({
  ...base(`add-${nodeId}`),
  op: 'add_node',
  node_id: nodeId,
  class_type: 'Source',
  pos: [0, 0],
  node: { id: Number(nodeId), type: 'Source', pos: [0, 0], size: [1, 1] }
})
const setTitle = (nodeId: string): Op => ({
  ...base(`title-${nodeId}`),
  op: 'set_node_field',
  node_id: nodeId,
  field: 'title',
  value: 't'
})

function docWith(nodes: Array<{ id: number; type: string }>, link?: number) {
  return mint(
    {
      nodes: nodes.map(({ id, type }) =>
        type === 'Source'
          ? {
              id,
              type,
              pos: [0, 0],
              size: [100, 100],
              widgets_values: [20],
              outputs: [
                {
                  name: 'image',
                  type: 'IMAGE',
                  links: link == null ? [] : [link]
                }
              ]
            }
          : {
              id,
              type,
              pos: [0, 0],
              size: [100, 100],
              inputs: [{ name: 'image', type: 'IMAGE', link: link ?? null }]
            }
      ),
      links: link == null ? [] : [[link, 1, 0, 2, 0, 'IMAGE']]
    },
    CATALOG
  )
}

describe('collectPendingLocalEdits', () => {
  it('folds top-level ops by kind and ignores interior widget writes', () => {
    const edits = collectPendingLocalEdits([
      deleteNode('2'),
      addNode('9'),
      setWidget('1', 30),
      setWidget('1', 'x', ['inner']),
      connect(7),
      disconnect(8),
      setTitle('1')
    ])

    expect(edits).toEqual({
      deletedNodeIds: new Set(['2']),
      addedNodeIds: new Set(['9']),
      widgetKeys: new Set([widgetKey(1, 'steps')]),
      linkIds: new Set([toLinkId(7), toLinkId(8)])
    })
  })
})

describe('docReflects', () => {
  it.for([
    {
      name: 'a delete once the node is gone',
      op: deleteNode('2'),
      before: false,
      apply: [deleteNode('2')]
    },
    {
      name: 'a widget write once the doc holds the value',
      op: setWidget('1', 30),
      before: false,
      apply: [setWidget('1', 30)]
    },
    {
      name: 'a connect once the link exists',
      op: connect(7),
      before: false,
      apply: [connect(7)]
    },
    {
      name: 'a disconnect once the link is gone',
      op: disconnect(40),
      before: false,
      apply: [disconnect(40)]
    }
  ])('reports $name', ({ op: pending, before, apply }) => {
    const doc = docWith(
      [
        { id: 1, type: 'Source' },
        { id: 2, type: 'Sink' }
      ],
      40
    )

    expect(docReflects(doc, pending)).toBe(before)
    const { outcomes } = applyOps(doc, apply, CATALOG)
    expect(outcomes.map(({ outcome }) => outcome)).toEqual(['applied'])
    expect(docReflects(doc, pending)).toBe(true)
  })

  it('treats a widget write to a different value as not yet reflected', () => {
    const doc = docWith([{ id: 1, type: 'Source' }])
    applyOps(doc, [setWidget('1', 25)], CATALOG)

    expect(docReflects(doc, setWidget('1', 30))).toBe(false)
  })

  it('never protects an interior write or a node field', () => {
    const doc = docWith([{ id: 1, type: 'Source' }])

    expect(docReflects(doc, setWidget('1', 'x', ['inner']))).toBe(true)
    expect(docReflects(doc, setTitle('1'))).toBe(true)
  })
})
