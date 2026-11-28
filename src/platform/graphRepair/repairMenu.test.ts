import { fromPartial } from '@total-typescript/shoehorn'
import fs from 'node:fs'
import path from 'node:path'
import { assert, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { convertContextMenuToOptions } from '@/composables/graph/contextMenuConverter'
import type { LGraphCanvas, Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  getCanvasRepairItems,
  getNodeRepairItems,
  toLitegraphRepairSection
} from './repairMenu'

function loadFixture(name: string) {
  const graph = new LGraph()
  graph.configure(
    JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../utils/migration/__fixtures__/reroute/legacy',
          name
        ),
        'utf-8'
      )
    )
  )
  return graph
}

function canvasFor(
  graph: LGraph,
  { readOnly = false, selected = [] as Positionable[] } = {}
) {
  return fromPartial<LGraphCanvas>({
    graph,
    state: { readOnly },
    selectedItems: new Set(selected)
  })
}

function node(graph: LGraph, id: number) {
  const found = graph.getNodeById(toNodeId(id))
  assert(found)
  return found
}

describe('Repair menu items', () => {
  it.for([
    {
      case: 'a convertible Reroute node',
      fixture: 'single_connected.json',
      target: 13,
      selected: [],
      expected: ['Convert to Link Reroute']
    },
    {
      case: 'a selection with two convertible Reroute nodes',
      fixture: 'branching.json',
      target: 13,
      selected: [13, 27, 12],
      expected: ['Convert 2 Reroute Nodes to Link Reroutes']
    },
    {
      case: 'a node that is not a Reroute',
      fixture: 'single_connected.json',
      target: 12,
      selected: [],
      expected: []
    },
    {
      case: 'a Reroute node that cannot be converted',
      fixture: 'floating.json',
      target: 13,
      selected: [],
      expected: []
    }
  ])(
    'offers node repairs for $case',
    ({ fixture, target, selected, expected }) => {
      const graph = loadFixture(fixture)
      const canvas = canvasFor(graph, {
        selected: selected.map((id) => node(graph, id))
      })

      expect(
        getNodeRepairItems(canvas, node(graph, target)).map(
          (item) => item.label
        )
      ).toEqual(expected)
    }
  )

  it.for([
    {
      fixture: 'branching.json',
      readOnly: false,
      expected: ['Convert All Reroute Nodes to Link Reroutes']
    },
    { fixture: 'branching.json', readOnly: true, expected: [] },
    { fixture: 'floating.json', readOnly: false, expected: [] }
  ])(
    'offers canvas repairs for $fixture when read-only is $readOnly',
    ({ fixture, readOnly, expected }) => {
      const canvas = canvasFor(loadFixture(fixture), { readOnly })

      expect(getCanvasRepairItems(canvas).map((item) => item.label)).toEqual(
        expected
      )
    }
  )

  it('converts the whole graph in one undo step and reports it', () => {
    const changeTracker = { beforeChange: vi.fn(), afterChange: vi.fn() }
    useWorkflowStore().activeWorkflow = fromPartial({ changeTracker })
    const graph = loadFixture('branching.json')
    const [item] = getCanvasRepairItems(canvasFor(graph))

    item.action()

    expect(graph.nodes.map((n) => n.type)).not.toContain('Reroute')
    expect(changeTracker.beforeChange).toHaveBeenCalledOnce()
    expect(changeTracker.afterChange).toHaveBeenCalledOnce()
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'success',
        title: 'Converted 3 Reroute nodes to link reroutes'
      })
    ])
  })
})

describe('LiteGraph Repair section', () => {
  it('is omitted, divider included, when nothing is eligible', () => {
    expect(toLitegraphRepairSection([])).toEqual([])
  })

  it('adds a divider and heading, and stays out of the Nodes 2.0 menu', () => {
    const action = vi.fn()
    const section = toLitegraphRepairSection([
      { id: 'convert', label: 'Convert', action }
    ])

    expect(
      section.map((item) => item && [item.content, !!item.disabled])
    ).toEqual([null, ['Repair', true], ['Convert', false]])
    void section[2]?.callback?.call(fromPartial<HTMLDivElement>({}))
    expect(action).toHaveBeenCalledOnce()
    expect(
      convertContextMenuToOptions(section).filter(
        (option) => option.type !== 'divider'
      )
    ).toEqual([])
  })
})
