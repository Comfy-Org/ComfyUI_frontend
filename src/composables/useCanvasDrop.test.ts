import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useCanvasDrop } from '@/composables/useCanvasDrop'
import { usePragmaticDroppable } from '@/composables/usePragmaticDragAndDrop'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLitegraphService } from '@/services/litegraphService'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { ComfyModelDef } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'

vi.mock(import('@/composables/usePragmaticDragAndDrop'), () => ({
  usePragmaticDraggable: vi.fn(),
  usePragmaticDroppable: vi.fn()
}))

vi.mock<unknown>(
  import('@/composables/element/useCanvasPositionConversion'),
  () => ({
    useSharedCanvasPositionConversion: () => ({
      clientPosToCanvasPos: (pos: [number, number]) => pos
    })
  })
)

vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/services/litegraphService'))
vi.mock(import('@/scripts/app'))

function registerDrop() {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  scope.run(() => useCanvasDrop(ref(document.createElement('canvas'))))
  const onDrop = vi.mocked(usePragmaticDroppable).mock.lastCall?.[1].onDrop
  if (!onDrop) throw new Error('canvas drop target was not registered')
  return onDrop
}

describe('useCanvasDrop', () => {
  it.for([
    { selector: 'model_a', description: 'exact widget name' },
    { selector: /^model_/, description: 'widget name pattern' }
  ])(
    'drops a model into the first widget matching $description',
    async ({ selector }) => {
      useNodeDefStore().nodeDefsByName = {
        TestLoader: fromPartial<ComfyNodeDefImpl>({ name: 'TestLoader' })
      }
      useModelToNodeStore().quickRegister('test-models', 'TestLoader', selector)
      const node = new LGraphNode('Test loader')
      node.comfyClass = 'TestLoader'
      const strength = node.addWidget('number', 'strength', 0.5, () => {})
      const first = node.addWidget('text', 'model_a', 'A.safetensors', () => {})
      const second = node.addWidget(
        'text',
        'model_b',
        'B.safetensors',
        () => {}
      )
      assert.exists(app.canvas.graph)
      vi.spyOn(app.canvas.graph, 'getNodeOnPos').mockReturnValue(node)
      const onDrop = registerDrop()

      await onDrop(
        fromPartial({
          location: { current: { input: { clientX: 10, clientY: 20 } } },
          source: {
            data: {
              type: 'tree-explorer-node',
              data: {
                data: new ComfyModelDef('C.safetensors', 'test-models', 0)
              }
            }
          }
        })
      )

      expect([strength.value, first.value, second.value]).toEqual([
        0.5,
        'C.safetensors',
        'B.safetensors'
      ])
      expect(useLitegraphService().addNodeOnGraph).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      description: 'takes the option with the separator the backend listed',
      dropped: 'SDXL/Juggernaut.safetensors',
      options: ['other.safetensors', 'SDXL\\Juggernaut.safetensors'],
      expected: 'SDXL\\Juggernaut.safetensors'
    },
    {
      description: 'keeps a name that is already one of the options',
      dropped: 'SDXL/Juggernaut.safetensors',
      options: ['SDXL/Juggernaut.safetensors'],
      expected: 'SDXL/Juggernaut.safetensors'
    },
    {
      description: 'keeps the dropped name when no option names that file',
      dropped: 'SDXL/Juggernaut.safetensors',
      options: ['other.safetensors'],
      expected: 'SDXL/Juggernaut.safetensors'
    }
  ])(
    'a model dropped onto a loader $description',
    async ({ dropped, options, expected }) => {
      useNodeDefStore().nodeDefsByName = {
        CheckpointLoader: fromPartial<ComfyNodeDefImpl>({
          name: 'CheckpointLoader'
        })
      }
      useModelToNodeStore().quickRegister(
        'checkpoints',
        'CheckpointLoader',
        'ckpt_name'
      )
      const node = new LGraphNode('Load Checkpoint')
      node.comfyClass = 'CheckpointLoader'
      const widget = node.addWidget(
        'combo',
        'ckpt_name',
        options[0],
        () => {},
        { values: options }
      )
      assert.exists(app.canvas.graph)
      vi.spyOn(app.canvas.graph, 'getNodeOnPos').mockReturnValue(node)
      const onDrop = registerDrop()

      await onDrop(
        fromPartial({
          location: { current: { input: { clientX: 10, clientY: 20 } } },
          source: {
            data: {
              type: 'tree-explorer-node',
              data: { data: new ComfyModelDef(dropped, 'checkpoints', 0) }
            }
          }
        })
      )

      expect(widget.value).toBe(expected)
    }
  )

  it.for([
    { selectOnly: false, inserts: 1 },
    { selectOnly: true, inserts: 0 }
  ])(
    'a sidebar workflow dropped with selectOnly=$selectOnly is inserted $inserts times',
    async ({ selectOnly, inserts }) => {
      app.canvas.selectOnly = selectOnly
      const onDrop = registerDrop()

      await onDrop(
        fromPartial({
          location: { current: { input: { clientX: 10, clientY: 20 } } },
          source: {
            data: {
              type: 'tree-explorer-node',
              data: {
                data: new ComfyWorkflow({
                  path: 'workflows/dropped.json',
                  modified: 0,
                  size: 0
                })
              }
            }
          }
        })
      )

      expect(useWorkflowService().insertWorkflow).toHaveBeenCalledTimes(inserts)
    }
  )
})
