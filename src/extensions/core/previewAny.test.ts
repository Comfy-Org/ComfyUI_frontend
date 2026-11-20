import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { createNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useTextPreviewSystem } from '@/systems/textPreviewSystem'

import { previewAnyExtension } from './previewAny'
import { saveTextExtension } from './saveText'

vi.mock(import('@/scripts/app'))

function createPreview(type = 'PreviewAny') {
  class PreviewNode extends LGraphNode {
    static comfyClass = type
    override comfyClass = type
  }
  const node = new PreviewNode(type)
  previewAnyExtension.nodeCreated?.(node, app)
  saveTextExtension.nodeCreated?.(node, app)
  app.rootGraph.add(node)
  const preview = node.widgets?.find((widget) => widget.name === 'preview_text')
  assert.exists(preview)
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  scope.run(useTextPreviewSystem)
  return { node, preview, scope, outputs: useNodeOutputStore() }
}

describe('built-in text output presentation', () => {
  it.for(['PreviewAny', 'SaveText'])(
    '%s displays stored outputs and clears when outputs are replaced',
    async (type) => {
      const { node, preview, outputs } = createPreview(type)

      outputs.setNodeOutputsByExecutionId(createNodeExecutionId([node.id]), {
        text: ['first', 'second']
      })
      await nextTick()
      expect(preview.value).toBe('first\n\nsecond')

      outputs.nodeOutputs = {}
      await nextTick()
      expect(preview.value).toBe('')
    }
  )

  it.for([
    { case: 'null', output: null },
    { case: 'undefined', output: undefined }
  ])('clears a nullish execution output: $case', async ({ output }) => {
    const { node, preview, outputs } = createPreview()
    const executionId = createNodeExecutionId([node.id])
    outputs.setNodeOutputsByExecutionId(executionId, {
      text: 'previous output'
    })
    await nextTick()

    outputs.setNodeOutputsByExecutionId(executionId, output, { merge: true })
    await nextTick()

    expect(preview.value).toBe('')
    expect(outputs.getNodeOutputs(node)).toEqual({})
  })

  it('writes only the preview whose text changed', async () => {
    const changed = createPreview()
    const unchanged = createPreview()
    const outputs = useNodeOutputStore()
    const unchangedExecutionId = createNodeExecutionId([unchanged.node.id])
    outputs.setNodeOutputsByExecutionId(unchangedExecutionId, { text: 'same' })
    await nextTick()
    unchanged.preview.callback = vi.fn()

    outputs.setNodeOutputsByExecutionId(
      createNodeExecutionId([changed.node.id]),
      {
        text: 'new'
      }
    )
    outputs.setNodeOutputsByExecutionId(unchangedExecutionId, { text: 'same' })
    await nextTick()

    expect(changed.preview.value).toBe('new')
    expect(unchanged.preview.value).toBe('same')
    expect(unchanged.preview.callback).not.toHaveBeenCalled()
  })

  it('retains unrelated node outputs when execution provides no output', () => {
    const node = new LGraphNode('Image output')
    app.rootGraph.add(node)
    const outputs = useNodeOutputStore()
    const executionId = createNodeExecutionId([node.id])
    const imageOutput = { images: [{ filename: 'retained.png' }] }
    outputs.setNodeOutputsByExecutionId(executionId, imageOutput)

    outputs.setNodeOutputsByExecutionId(executionId, null)

    expect(outputs.getNodeOutputs(node)).toEqual(imageOutput)
  })

  it('restores saved output when a preview is registered', async () => {
    const outputs = useNodeOutputStore()
    outputs.nodeOutputs['1'] = { text: 'restored' }

    const { preview } = createPreview()
    await nextTick()

    expect(preview.value).toBe('restored')
  })

  it('does not persist output text or preview mode in the workflow', async () => {
    const { node, preview, outputs } = createPreview()
    node.serialize_widgets = true
    outputs.nodeOutputs[String(node.id)] = { text: 'runtime only' }
    await nextTick()

    expect(preview.value).toBe('runtime only')
    expect(node.serialize().widgets_values).toEqual([])
  })

  it('stops updating removed widgets and restores output on re-add', async () => {
    const { node, preview, outputs } = createPreview()
    outputs.nodeOutputs[String(node.id)] = { text: 'before removal' }
    await nextTick()

    app.rootGraph.remove(node)
    outputs.nodeOutputs[String(node.id)] = { text: 'after removal' }
    await nextTick()

    expect(preview.value).toBe('before removal')

    app.rootGraph.add(node)
    await nextTick()

    expect(preview.value).toBe('after removal')
    expect(node.widgets?.map((widget) => widget.name)).toEqual([
      'preview_text',
      'preview_mode'
    ])
  })

  it('stops projecting when the application scope is disposed', async () => {
    const { node, preview, scope, outputs } = createPreview()
    scope.stop()

    outputs.nodeOutputs[String(node.id)] = { text: 'after disposal' }
    await nextTick()

    expect(preview.value).toBe('')
  })
})
