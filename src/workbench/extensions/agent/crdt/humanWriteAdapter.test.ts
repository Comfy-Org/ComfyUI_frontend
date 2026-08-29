import type { Op } from '@comfyorg/comfy-multi-player'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import type { LayoutChangeView } from './layoutMintPort'
import { attachMintPortWiring } from './mintPortWiring'
import { createOpSender } from './opSender'
import type { OpsResultView } from './opSender'

describe('human canvas mutation to doc_ops', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('mints and sends the frozen small vocabulary end-to-end', async () => {
    const sent: Op[][] = []
    let result: ((value: OpsResultView) => void) | null = null
    const sender = createOpSender({
      sendOps: (_workflowId, _tab, ops) => {
        sent.push(ops)
        return true
      },
      onOpsResult: (listener) => {
        result = listener
        return () => undefined
      },
      workflowId: () => 'wf-1',
      tab: 'tab-1',
      actor: () => 'human:user-1:tab-1',
      baseVersion: () => 17,
      onBatchSettled: () => undefined
    })
    const layoutListeners = new Set<(change: LayoutChangeView) => void>()
    const node = {
      id: 5,
      type: 'LoadImage',
      widgets: [{ name: 'image', type: 'combo' }],
      serialize: () => ({
        id: 5,
        type: 'LoadImage',
        widgets_values_named: { image: 'cat.png' }
      })
    } as unknown as LGraphNode
    const wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: sender.enqueue,
      layoutChanges: (listener) => {
        layoutListeners.add(listener)
        return () => layoutListeners.delete(listener)
      },
      withLayoutActor: (_actor, fn) => fn(),
      localActorPrefix: 'user-',
      getGraph: () => ({
        id: 'wf-1',
        rootGraph: { id: 'wf-1' },
        getNodeById: (id) => (String(id) === '5' ? node : null),
        _nodes: [node]
      })
    })
    const deliver = (change: LayoutChangeView): void => {
      for (const listener of layoutListeners) listener(change)
    }
    const ack = (): void => {
      const ops = sent.at(-1) ?? []
      result?.({
        ok: true,
        applied: ops.map((operation) => operation.op_id),
        skipped: []
      })
    }

    deliver({
      operation: {
        type: 'createNode',
        actor: 'user-local',
        nodeId: toNodeId(5),
        layout: { position: { x: 10, y: 20 } }
      }
    })
    ack()

    const scope = {
      rootGraphId: toRootGraphId('wf-1'),
      owningGraphId: toOwningGraphId('wf-1')
    }
    const link: LinkTopology = {
      id: toLinkId(41),
      graphId: toOwningGraphId('wf-1'),
      originNodeId: toNodeId(5),
      originSlot: 0,
      targetNodeId: toNodeId(6),
      targetSlot: 1,
      type: 'IMAGE'
    }
    useLinkStore().registerLink(scope, link)
    ack()

    const valueId = widgetId('wf-1', toNodeId(5), 'image')
    const widgetStore = useWidgetValueStore()
    widgetStore.registerWidget(valueId, {
      type: 'combo',
      value: 'cat.png'
    } as Parameters<typeof widgetStore.registerWidget>[1])
    widgetStore.setValue(valueId, 'dog.png')
    ack()

    useLinkStore().deleteLink(scope, link)
    deliver({
      operation: {
        type: 'deleteNode',
        actor: 'user-local',
        nodeId: toNodeId(5)
      }
    })
    ack()
    await Promise.resolve()

    expect(sent.map(([operation]) => operation.op)).toEqual([
      'add_node',
      'connect',
      'set_widget',
      'delete_node'
    ])
    expect(sent[3][0]).toMatchObject({ removed_links: [toLinkId(41)] })
    for (const [operation] of sent) {
      expect(operation.op_id).toMatch(/^[0-9a-f]{32}$/)
      expect(operation.actor).toBe('human:user-1:tab-1')
      expect(operation.base_version).toBe(17)
    }

    wiring.detach()
    sender.detach()
  })
})
