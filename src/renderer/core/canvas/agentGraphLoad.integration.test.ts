import { getActivePinia } from 'pinia'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useAgentGeneratedNodesStore } from '@/workbench/extensions/agent/stores/agentGeneratedNodesStore'

vi.mock(import('firebase/auth'))

async function workflow(name: string, id: number) {
  const graph = new LGraph()
  const node = new LGraphNode(`Node ${id}`, 'LoadImage')
  node.id = toNodeId(id)
  graph.add(node)
  const contents = zComfyWorkflow.parse(graph.serialize())
  graph.clear()
  const workflows = useWorkflowStore()
  const loaded = await workflows.createTemporary(name, contents).load()
  workflows.attachWorkflow(loaded)
  return loaded
}

describe('agent feedback through workflow loading', () => {
  let service: ReturnType<typeof useWorkflowService>

  beforeEach(() => {
    const pinia = getActivePinia()
    if (!pinia) throw new Error('Expected test Pinia')
    const context = createApp({ render: () => null })
      .use(pinia)
      .use(
        createRouter({
          history: createMemoryHistory(),
          routes: [
            { path: '/:pathMatch(.*)*', component: { template: '<div />' } }
          ]
        })
      )
    const graph = new LGraph()
    const element = document.createElement('canvas')
    element.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    const canvas = new LGraphCanvas(element, graph, {
      skip_events: true,
      skip_render: true
    })
    Reflect.set(app, 'rootGraphInternal', graph)
    app.canvas = canvas
    app.canvasElRef.value = element
    useCanvasStore().canvas = canvas
    service = context.runWithContext(useWorkflowService)
  })

  it.for([false, true])(
    'retains modified workflow feedback with a failed replacement: %s',
    async (failReplacement) => {
      const a = await workflow('a.json', 11)
      const b = await workflow('b.json', 12)
      const feedback = useAgentGeneratedNodesStore()
      expect(await service.openWorkflow(a, { force: true })).toBe(true)
      const activeA = useWorkflowStore().activeWorkflow
      const node = app.rootGraph.getNodeById(toNodeId(11))
      if (!activeA || !node) throw new Error('Expected workflow A and its node')
      const scope = graphScopeOf(app.rootGraph)
      feedback.beginTurn(toTurnId('turn-a'), 'test')
      useNodeDataStore().deleteNode(scope, node._state)
      useNodeDataStore().registerNode(scope, node._state, {
        source: 'agent-remote',
        actor: 'agent:test',
        opId: 'op-11'
      })
      node.pos = [123, 234]
      activeA.changeTracker.captureCanvasState()
      const markedAt = feedback.generatedAtFor(scope, node.id)
      expect(markedAt).toBeTypeOf('number')
      if (failReplacement) {
        vi.spyOn(app.rootGraph, 'configure').mockImplementationOnce(() => {
          throw new Error('Replacement configure failed')
        })
      }

      expect(await service.openWorkflow(b, { force: true })).toBe(
        !failReplacement
      )
      if (failReplacement) {
        expect(useWorkflowStore().activeWorkflow).toBe(activeA)
        expect(feedback.generatedAtFor(scope, node.id)).toBe(markedAt)
        expect(feedback.activities.get(scope.rootGraphId)?.nodes).toEqual([
          '11'
        ])
      }
      expect(await service.openWorkflow(activeA, { force: true })).toBe(true)
      const restored = app.rootGraph.getNodeById(node.id)
      if (!restored) throw new Error('Expected restored node')
      expect([...restored.pos]).toEqual([123, 234])
      expect(feedback.generatedAtFor(scope, node.id)).toBe(markedAt)
      expect(feedback.activities.get(scope.rootGraphId)?.nodes).toEqual(['11'])
    }
  )
})
