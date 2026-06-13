import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeExecutionOutput } from '@/schemas/apiSchema'
import type { ComfyExtension } from '@/types/comfy'

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

vi.mock('@/scripts/app', () => ({ app: {} }))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: getNodeByLocatorIdMock
}))

type PreviewAnyExtension = ComfyExtension & {
  onNodeOutputsUpdated: (
    nodeOutputs: Record<string, NodeExecutionOutput>
  ) => void
}

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

const createdWidgets: MockWidget[] = []

vi.mock('@/scripts/widgets', () => {
  const create =
    (kind: string) =>
    (
      node: { widgets?: MockWidget[] },
      name: string,
      _info: unknown,
      _app: unknown
    ) => {
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

    const node: {
      widgets?: MockWidget[]
      constructor: { comfyClass: string }
    } = { constructor: { comfyClass: 'PreviewAny' } }
    const proto = nodeType.prototype as { onNodeCreated?: () => void }
    proto.onNodeCreated!.call(node)
    return { node, nodeType }
  }

  function getRestoreHook() {
    const ext = capturedExtensions.find(
      (e) => e.name === 'Comfy.PreviewAny'
    ) as PreviewAnyExtension | undefined
    expect(ext).toBeDefined()
    return ext!.onNodeOutputsUpdated
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

    // widget.options.serialize === false is what executionUtil.graphToPrompt
    // checks to exclude a widget from the API prompt sent to the backend.
    // Without this, post-execution widget value updates (the rendered preview
    // text) get serialized as inputs, change the cache signature, and cause
    // the node to re-execute on the next prompt.
    expect(previewMarkdown!.options.serialize).toBe(false)
    expect(previewText!.options.serialize).toBe(false)
    expect(previewMode!.options.serialize).toBe(false)
  })

  it('repopulates preview widgets when outputs are restored on tab switch', async () => {
    const { node } = await setupNode()
    getNodeByLocatorIdMock.mockReturnValue(node)

    getRestoreHook()({ '1': { text: 'restored text' } })

    const previewText = node.widgets!.find((w) => w.name === 'preview_text')
    const previewMarkdown = node.widgets!.find(
      (w) => w.name === 'preview_markdown'
    )
    const previewMode = node.widgets!.find((w) => w.name === 'previewMode')
    expect(previewText!.value).toBe('restored text')
    expect(previewMarkdown!.value).toBe('restored text')
    expect(previewMode!.value).toBe(false)
  })

  it('joins array text with blank lines on restore', async () => {
    const { node } = await setupNode()
    getNodeByLocatorIdMock.mockReturnValue(node)

    getRestoreHook()({ '1': { text: ['a', 'b'] } })

    const previewText = node.widgets!.find((w) => w.name === 'preview_text')
    expect(previewText!.value).toBe('a\n\nb')
  })

  it('ignores restored outputs for nodes that are not PreviewAny', async () => {
    const { node } = await setupNode()
    node.constructor.comfyClass = 'OtherNode'
    getNodeByLocatorIdMock.mockReturnValue(node)

    getRestoreHook()({ '1': { text: 'should be ignored' } })

    const previewText = node.widgets!.find((w) => w.name === 'preview_text')
    expect(previewText!.value).toBe('')
  })

  it('ignores restored locators that resolve to no node', async () => {
    await setupNode()
    getNodeByLocatorIdMock.mockReturnValue(null)

    expect(() => getRestoreHook()({ '1': { text: 'x' } })).not.toThrow()
  })

  it('still populates preview widgets on live execution via onExecuted', async () => {
    const { node, nodeType } = await setupNode()
    const proto = nodeType.prototype as {
      onExecuted?: (message: NodeExecutionOutput) => void
    }

    proto.onExecuted!.call(node, { text: 'executed text' })

    const previewText = node.widgets!.find((w) => w.name === 'preview_text')
    expect(previewText!.value).toBe('executed text')
  })
})
