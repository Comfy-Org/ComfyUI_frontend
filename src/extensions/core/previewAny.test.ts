import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeExecutionOutput } from '@/schemas/apiSchema'
import type { ComfyExtension } from '@/types/comfy'
import { toNodeId } from '@/types/nodeId'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { createNodeLocatorId } from '@/types/nodeIdentification'

const { getNodeByLocatorIdMock } = vi.hoisted(() => ({
  getNodeByLocatorIdMock: vi.fn()
}))

const capturedExtensions: ComfyExtension[] = []

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: ComfyExtension) => {
      capturedExtensions.push(ext)
    }
  })
}))

vi.mock('@/scripts/app', () => ({ app: { rootGraph: {} } }))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: getNodeByLocatorIdMock
}))

interface MockWidget {
  name: string
  options: Record<string, unknown>
  element: { readOnly: boolean }
  callback?: (value: unknown) => void
  value: unknown
  hidden: boolean
  label: string
  serialize?: boolean
}

interface MockNode {
  widgets?: MockWidget[]
  comfyClass?: string
}

type PreviewAnyExtension = ComfyExtension & {
  onNodeOutputsUpdated: (
    nodeOutputs: Record<NodeLocatorId, NodeExecutionOutput>
  ) => void
}

const createdWidgets: MockWidget[] = []

vi.mock('@/scripts/widgets', () => {
  const create =
    (kind: string) =>
    (node: MockNode, name: string, _info: unknown, _app: unknown) => {
      const widget: MockWidget = {
        name,
        options: {},
        element: { readOnly: false },
        value: kind === 'BOOLEAN' ? false : '',
        hidden: false,
        label: ''
      }
      node.widgets = node.widgets ?? []
      node.widgets.push(widget)
      createdWidgets.push(widget)
      return { widget }
    }
  return {
    ComfyWidgets: {
      MARKDOWN: create('MARKDOWN'),
      STRING: create('STRING'),
      BOOLEAN: create('BOOLEAN')
    }
  }
})

describe('PreviewAny extension', () => {
  beforeEach(async () => {
    capturedExtensions.length = 0
    createdWidgets.length = 0
    getNodeByLocatorIdMock.mockReset()
    vi.resetModules()
    await import('./previewAny')
  })

  async function setupNode() {
    const ext = capturedExtensions.find((e) => e.name === 'Comfy.PreviewAny')
    expect(ext).toBeDefined()

    const nodeType = { prototype: {} } as unknown as Parameters<
      NonNullable<ComfyExtension['beforeRegisterNodeDef']>
    >[0]
    const nodeData = { name: 'PreviewAny' } as Parameters<
      NonNullable<ComfyExtension['beforeRegisterNodeDef']>
    >[1]

    await ext!.beforeRegisterNodeDef!(
      nodeType,
      nodeData,
      {} as Parameters<NonNullable<ComfyExtension['beforeRegisterNodeDef']>>[2]
    )

    const node: MockNode = { comfyClass: 'PreviewAny' }
    const proto = nodeType.prototype as { onNodeCreated?: () => void }
    proto.onNodeCreated!.call(node)
    return { ext: ext! as PreviewAnyExtension, node }
  }

  it('excludes preview widgets from the API prompt to prevent re-execution', async () => {
    await setupNode()

    const previewMarkdown = createdWidgets.find(
      (w) => w.name === 'preview_markdown'
    )
    const previewText = createdWidgets.find((w) => w.name === 'preview_text')
    const previewMode = createdWidgets.find((w) => w.name === 'previewMode')

    expect(previewMarkdown).toBeDefined()
    expect(previewText).toBeDefined()
    expect(previewMode).toBeDefined()

    expect(previewMode!.label).toBe('Preview Mode')
    // widget.options.serialize === false is what executionUtil.graphToPrompt
    // checks to exclude a widget from the API prompt sent to the backend.
    // Without this, post-execution widget value updates (the rendered preview
    // text) get serialized as inputs, change the cache signature, and cause
    // the node to re-execute on the next prompt.
    expect(previewMarkdown!.options.serialize).toBe(false)
    expect(previewText!.options.serialize).toBe(false)
    expect(previewMode!.options.serialize).toBe(false)
  })

  it('restores preview widgets from node output updates', async () => {
    const { ext, node } = await setupNode()
    getNodeByLocatorIdMock.mockReturnValue(node)
    const locatorId = createNodeLocatorId(null, toNodeId(1))

    ext.onNodeOutputsUpdated({
      [locatorId]: { text: 'restored preview text' }
    })

    expect(
      createdWidgets.find((w) => w.name === 'preview_markdown')?.value
    ).toBe('restored preview text')
    expect(createdWidgets.find((w) => w.name === 'preview_text')?.value).toBe(
      'restored preview text'
    )
  })
})
