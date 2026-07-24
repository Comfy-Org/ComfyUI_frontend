import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const { addTextPreviewWidgets, updateTextPreviewWidgets } = vi.hoisted(() => ({
  addTextPreviewWidgets: vi.fn(),
  updateTextPreviewWidgets: vi.fn()
}))

vi.mock('@/extensions/core/textPreviewWidgets', () => ({
  addTextPreviewWidgets,
  updateTextPreviewWidgets
}))

const capturedExtensions: ComfyExtension[] = []

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: ComfyExtension) => {
      capturedExtensions.push(ext)
    }
  })
}))

type BeforeRegister = NonNullable<ComfyExtension['beforeRegisterNodeDef']>

async function setupNode() {
  const ext = capturedExtensions.find((e) => e.name === 'Comfy.PreviewAny')
  expect(ext).toBeDefined()

  const nodeType = { prototype: {} } as unknown as Parameters<BeforeRegister>[0]
  const nodeData = { name: 'PreviewAny' } as Parameters<BeforeRegister>[1]
  await ext!.beforeRegisterNodeDef!(
    nodeType,
    nodeData,
    {} as Parameters<BeforeRegister>[2]
  )

  const node = {} as LGraphNode
  const proto = nodeType.prototype as {
    onNodeCreated?: () => void
    onExecuted?: (message: { text?: string }) => void
  }
  return { node, proto }
}

describe('PreviewAny extension', () => {
  beforeEach(async () => {
    capturedExtensions.length = 0
    addTextPreviewWidgets.mockClear()
    updateTextPreviewWidgets.mockClear()
    vi.resetModules()
    await import('./previewAny')
  })

  it('adds the shared text preview widgets on node creation', async () => {
    const { node, proto } = await setupNode()

    proto.onNodeCreated!.call(node)

    expect(addTextPreviewWidgets).toHaveBeenCalledWith(node)
  })

  it('updates the preview with executed text', async () => {
    const { node, proto } = await setupNode()
    const message = { text: 'hello' }

    proto.onExecuted!.call(node, message)

    expect(updateTextPreviewWidgets).toHaveBeenCalledWith(node, message)
  })
})
