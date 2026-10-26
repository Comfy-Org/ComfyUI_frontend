import { nodesMap } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { reportError } from '@/platform/telemetry/reportError'
import { useLitegraphService } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'
import { applyRemoteDynamicGroupRowCount } from './dynamicGroupDiagnostics'
import { toNodeId } from '@/types/nodeId'
import { followedDoc } from '@/workbench/extensions/agent/crdt/__fixtures__/followedDoc'
import { LiveGraphApplier } from '@/workbench/extensions/agent/crdt/liveGraphApplier'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

vi.mock(import('@/platform/telemetry/reportError'))

function addGroup(node: LGraphNode, min = 0) {
  useLitegraphService().addNodeInput(node, {
    name: 'rows',
    type: 'COMFY_DYNAMICGROUP_V3',
    isOptional: false,
    min,
    max: 3,
    template: { required: { strength: ['FLOAT', { default: 1 }] } }
  })
}

function group(type: string, { min = 0, count = 2 } = {}) {
  const graph = new LGraph()
  const node = new LGraphNode('Group', type)
  node.serialize_widgets = true
  graph.add(node)
  addGroup(node, min)
  function widget(name: string) {
    const found = node.widgets?.find((widget) => widget.name === name)
    if (!found) throw new Error(`Missing widget ${name}`)
    return found
  }
  widget('rows').value = count
  return { node, widget }
}

function refuseInputChanges() {
  vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
    ok: false,
    error: { code: 'unowned-topology', message: 'Rejected' }
  })
}

beforeEach(() => {
  remoteConfig.value = { enable_telemetry: true }
})

afterEach(() => {
  distribution.isCloud = false
  remoteConfig.value = {}
})

describe('DynamicGroup row refusal reports', () => {
  function rowRefusal(
    type: string,
    operation: string,
    requested: number,
    actual: number
  ) {
    return [
      expect.objectContaining({ message: 'Refused a DynamicGroup row change' }),
      {
        errorType: 'failure_resizing_dynamic_group_rows',
        surface: 'graph',
        level: 'warning',
        tags: { node_type: type, operation, in_subgraph: false },
        context: { requested, actual }
      }
    ]
  }

  type Widget = ReturnType<typeof group>['widget']

  it.for([
    {
      name: 'an added row',
      operation: 'add_row',
      requested: 3,
      change: (widget: Widget) => (widget('rows').value = 3)
    },
    {
      name: 'a count reduction',
      operation: 'remove_row',
      requested: 0,
      change: (widget: Widget) => (widget('rows').value = 0)
    },
    {
      name: "a row's remove button",
      operation: 'remove_row',
      requested: 1,
      change: (widget: Widget) => widget('rows.0').callback?.(undefined)
    }
  ])(
    'reports a refused change from $name with counts only',
    ({ name, operation, requested, change }) => {
      const { widget } = group(name)
      refuseInputChanges()

      change(widget)

      expect(widget('rows').value).toBe(2)
      expect(vi.mocked(reportError).mock.calls).toEqual([
        rowRefusal(name, operation, requested, 2)
      ])
    }
  )

  it('does not report successful changes or a count clamped up to min', () => {
    const { widget } = group('Accepted changes', { min: 1, count: 3 })
    widget('rows').value = -1
    widget('rows.$add').callback?.(undefined)
    widget('rows.1').callback?.(undefined)

    expect(widget('rows').value).toBe(1)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports each node type and operation once per session', () => {
    const first = group('Deduped refusal')
    const second = group('Deduped refusal')
    const other = group('Other refusal')
    refuseInputChanges()

    first.widget('rows').value = 3
    first.widget('rows').value = 0
    first.widget('rows').value = 4
    second.widget('rows').value = 3
    other.widget('rows').value = 3

    expect(vi.mocked(reportError).mock.calls).toEqual([
      rowRefusal('Deduped refusal', 'add_row', 3, 2),
      rowRefusal('Deduped refusal', 'remove_row', 0, 2),
      rowRefusal('Other refusal', 'add_row', 3, 2)
    ])
  })

  const resizeRefusal = ['failure_resizing_dynamic_group_rows']
  it.for([
    { isCloud: false, enableTelemetry: false, reported: [] },
    { isCloud: false, enableTelemetry: true, reported: resizeRefusal },
    { isCloud: true, enableTelemetry: false, reported: resizeRefusal }
  ])(
    'sends with cloud=$isCloud and host telemetry=$enableTelemetry: $reported',
    ({ isCloud, enableTelemetry, reported }) => {
      distribution.isCloud = isCloud
      remoteConfig.value = { enable_telemetry: enableTelemetry }
      const { widget } = group(`Gated ${isCloud} ${enableTelemetry}`)
      refuseInputChanges()

      widget('rows').value = 3

      expect(
        vi
          .mocked(reportError)
          .mock.calls.map(([, options]) => options.errorType)
      ).toEqual(reported)
    }
  )
})

describe('remote DynamicGroup row count writes', () => {
  it('suppresses only the target node and restores an outer target', () => {
    const outer = group('OuterRemoteTarget')
    const inner = group('InnerRemoteTarget')
    const other = group('LocalDuringRemote')
    refuseInputChanges()

    applyRemoteDynamicGroupRowCount(outer.node, () => {
      applyRemoteDynamicGroupRowCount(inner.node, () => {})
      outer.widget('rows').value = 3
      other.widget('rows').value = 3
    })

    expect(
      vi.mocked(reportError).mock.calls.map(([, options]) => options.tags)
    ).toEqual([expect.objectContaining({ node_type: 'LocalDuringRemote' })])
  })
})

describe('remote DynamicGroup row count reports', () => {
  function remoteNodeType(min: number) {
    return class extends LGraphNode {
      constructor() {
        super('Remote Dynamic Group')
        this.serialize_widgets = true
        addGroup(this, min)
      }
    }
  }

  beforeEach(() => {
    LiteGraph.registerNodeType('RemoteDynamicGroup', remoteNodeType(0))
    LiteGraph.registerNodeType('MinOneDynamicGroup', remoteNodeType(1))
    LiteGraph.registerNodeType('ConsentDynamicGroup', remoteNodeType(0))
    LiteGraph.registerNodeType('AboveMaxDynamicGroup', remoteNodeType(0))
    LiteGraph.registerNodeType('HugeDynamicGroup', remoteNodeType(0))
    LiteGraph.registerNodeType('RestoredDynamicGroup', remoteNodeType(0))
    LiteGraph.registerNodeType('RestoredEqualDynamicGroup', remoteNodeType(0))
    LiteGraph.registerNodeType('RestoredShrinkDynamicGroup', remoteNodeType(0))
    LiteGraph.registerNodeType('RestoredRegrowDynamicGroup', remoteNodeType(0))
  })

  function remoteGroup(type = 'RemoteDynamicGroup') {
    const graph = new LGraph()
    const { doc, collector } = followedDoc(
      {
        nodes: [
          {
            id: 1,
            type,
            pos: [0, 0],
            size: [210, 100],
            widgets_values: [1, 0.5]
          }
        ],
        links: []
      },
      {
        types: {
          [type]: {
            widget_order: ['rows', 'rows.0.strength', 'rows.1.strength']
          }
        }
      }
    )
    const applier = new LiveGraphApplier({ getGraph: () => graph })
    const context = { actor: 'agent:test', opIds: ['op-1'] }
    applier.applyChanges(doc, collector.take(), context)
    const node = graph.getNodeById(toNodeId(1))
    const rows = node?.widgets?.find((widget) => widget.name === 'rows')
    if (!node || !rows) throw new Error('DynamicGroup node 1 was not created')
    function setRows(count: unknown, rowValues: Record<string, number> = {}) {
      doc.transact(() => {
        const widgets = nodesMap(doc).get('1')?.get('widgets')
        if (!(widgets instanceof Y.Map)) throw new Error('named storage')
        widgets.set('rows', count)
        for (const [name, value] of Object.entries(rowValues))
          widgets.set(name, value)
      })
      return applier.applyChanges(doc, collector.take(), context).failureCount
    }
    return { node, rows, setRows }
  }

  it('applies a remote row count without reporting', () => {
    const { rows, setRows } = remoteGroup()

    expect([setRows(2), setRows(0)]).toEqual([0, 0])
    expect(rows.value).toBe(0)
    expect(reportError).not.toHaveBeenCalled()
  })

  it.for([
    { type: 'RemoteDynamicGroup', value: 2.5, expected: 2 },
    { type: 'RemoteDynamicGroup', value: -0, expected: 0 },
    { type: 'MinOneDynamicGroup', value: 0, expected: 1 }
  ])(
    'does not report a remote $value the $type setter normalizes',
    ({ type, value, expected }) => {
      const { rows, setRows } = remoteGroup(type)

      expect(setRows(value)).toBe(0)
      expect(rows.value).toBe(expected)
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('applies a remote row count at max', () => {
    const { rows, setRows } = remoteGroup()

    expect(setRows(3)).toBe(0)
    expect(rows.value).toBe(3)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('applies a remote row count above max', () => {
    const { rows, setRows } = remoteGroup('AboveMaxDynamicGroup')

    expect(setRows(4)).toBe(0)
    expect(rows.value).toBe(4)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('refuses a remote row count above the allocation bound without adding rows', () => {
    const { node, rows, setRows } = remoteGroup('HugeDynamicGroup')
    const add = vi.spyOn(node, 'addCustomWidget').mockImplementation(() => {
      throw new Error('Unexpected row allocation')
    })

    expect(setRows(1e9)).toBe(1)
    expect(add).not.toHaveBeenCalled()
    expect(rows.value).toBe(1)
    expect(vi.mocked(reportError).mock.calls).toEqual([
      [
        expect.objectContaining({
          message: 'Remote DynamicGroup row count did not apply'
        }),
        expect.objectContaining({
          errorType: 'agent_graph_dynamic_group_rows_mismatch',
          context: { requested: 1e9, actual: 1 }
        })
      ]
    ])
  })

  function restoredGroup(type: string, count: number) {
    const group = remoteGroup(type)
    group.node.configure({
      ...group.node.serialize(),
      widgets_values: [count, ...Array(count).fill(1)]
    })
    expect(group.rows.value).toBe(count)
    return group
  }

  it.for([
    { type: 'RestoredEqualDynamicGroup', saved: 4, value: 4 },
    { type: 'RestoredShrinkDynamicGroup', saved: 5, value: 4 }
  ])(
    'applies a remote row count of $value to a group restored with $saved rows above max',
    ({ type, saved, value }) => {
      const { rows, setRows } = restoredGroup(type, saved)

      expect(setRows(value)).toBe(0)
      expect(rows.value).toBe(value)
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('applies a remote row count that restores rows the document still holds', () => {
    const { rows, setRows } = restoredGroup('RestoredRegrowDynamicGroup', 5)
    rows.value = 4
    const rowValues = Object.fromEntries(
      Array.from({ length: 5 }, (_, index) => [`rows.${index}.strength`, 1])
    )

    expect(setRows(5, rowValues)).toBe(0)
    expect(rows.value).toBe(5)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('applies a remote row count that grows a restored group further above max', () => {
    const { rows, setRows } = restoredGroup('RestoredDynamicGroup', 4)

    expect(setRows(5)).toBe(0)
    expect(rows.value).toBe(5)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a remote row count the live group did not reach, once per node type', () => {
    const { rows, setRows } = remoteGroup()
    refuseInputChanges()

    expect([setRows(3), setRows(2)]).toEqual([1, 1])
    expect(rows.value).toBe(1)
    expect(vi.mocked(reportError).mock.calls).toEqual([
      [
        expect.objectContaining({
          message: 'Remote DynamicGroup row count did not apply'
        }),
        {
          errorType: 'agent_graph_dynamic_group_rows_mismatch',
          surface: 'agent',
          tags: {
            subsystem: 'agent-crdt',
            layer: 'graph-api',
            outcome: 'degraded',
            node_type: 'RemoteDynamicGroup',
            operation: 'remote_apply',
            in_subgraph: false
          },
          context: { requested: 3, actual: 1 }
        }
      ]
    ])
  })

  it('counts but does not send a mismatch without telemetry consent', () => {
    remoteConfig.value = {}
    const { setRows } = remoteGroup('ConsentDynamicGroup')
    refuseInputChanges()

    expect(setRows(2)).toBe(1)
    expect(reportError).not.toHaveBeenCalled()
  })
})
