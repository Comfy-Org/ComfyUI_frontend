import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'

const { registerExtensionMock } = vi.hoisted(() => ({
  registerExtensionMock: vi.fn()
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension: registerExtensionMock })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

type SeedExtension = ComfyExtension & {
  beforeRegisterNodeDef: (
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) => Promise<void>
}

async function loadExtensionFresh(): Promise<SeedExtension> {
  vi.resetModules()
  registerExtensionMock.mockClear()
  await import('./seedNode')
  return registerExtensionMock.mock.calls[0][0] as SeedExtension
}

async function registerNode(extension: SeedExtension, name = 'SeedNode') {
  const nodeType = { prototype: {} as { onNodeCreated?: () => void } }
  await extension.beforeRegisterNodeDef(
    nodeType as never,
    {
      name
    } as ComfyNodeDef
  )
  return nodeType
}

interface FakeButton {
  type: string
  name: string
  value: string
  callback: () => void
  options: { serialize: boolean }
}

function createFakeNode(seedOptions: Record<string, unknown>) {
  const seedWidget = {
    name: 'seed',
    value: 0,
    options: seedOptions,
    callback: vi.fn()
  }
  const buttons: FakeButton[] = []
  const node = {
    widgets: [seedWidget],
    size: [100, 100] as [number, number],
    addWidget: vi.fn(
      (
        type: string,
        name: string,
        value: string,
        callback: () => void,
        options: { serialize: boolean }
      ) => {
        const button = { type, name, value, callback, options }
        buttons.push(button)
        return button
      }
    ),
    computeSize: vi.fn(() => [150, 150] as [number, number]),
    setDirtyCanvas: vi.fn()
  }
  return { node, seedWidget, buttons }
}

describe('Comfy.SeedNode', () => {
  let extension: SeedExtension

  beforeEach(async () => {
    extension = await loadExtensionFresh()
  })

  it('ignores nodes other than SeedNode', async () => {
    const nodeType = await registerNode(extension, 'OtherNode')
    expect(nodeType.prototype.onNodeCreated).toBeUndefined()
  })

  it('adds a non-serialized randomize button to SeedNode', async () => {
    const nodeType = await registerNode(extension)
    const { node, buttons } = createFakeNode({ min: 0, max: 100, step2: 1 })
    nodeType.prototype.onNodeCreated!.call(node)

    expect(node.addWidget).toHaveBeenCalledWith(
      'button',
      'g.randomizeSeed',
      '',
      expect.any(Function),
      { serialize: false }
    )
    expect(buttons[0].type).toBe('button')
  })

  it('randomizes the seed within the widget range on click', async () => {
    const nodeType = await registerNode(extension)
    const { node, seedWidget, buttons } = createFakeNode({
      min: 10,
      max: 20,
      step2: 2
    })
    nodeType.prototype.onNodeCreated!.call(node)

    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    buttons[0].callback()

    expect(seedWidget.value).toBeGreaterThanOrEqual(10)
    expect(seedWidget.value).toBeLessThanOrEqual(20)
    expect((seedWidget.value as number) % 2).toBe(0)
    expect(seedWidget.callback).toHaveBeenCalledWith(seedWidget.value)
    expect(node.setDirtyCanvas).toHaveBeenCalledWith(true, true)
  })

  it('caps a seed max that exceeds the safe integer range', async () => {
    const nodeType = await registerNode(extension)
    const { node, seedWidget } = createFakeNode({
      min: 0,
      max: 9223372036854775807,
      step2: 1
    })
    nodeType.prototype.onNodeCreated!.call(node)

    expect(seedWidget.options.max).toBe(1125899906842624)
  })

  it('leaves a seed max within the safe range unchanged', async () => {
    const nodeType = await registerNode(extension)
    const { node, seedWidget } = createFakeNode({ min: 0, max: 100, step2: 1 })
    nodeType.prototype.onNodeCreated!.call(node)

    expect(seedWidget.options.max).toBe(100)
  })

  it('does nothing when the seed widget is missing', async () => {
    const nodeType = await registerNode(extension)
    const { node, buttons } = createFakeNode({ min: 0, max: 100, step2: 1 })
    node.widgets = []

    nodeType.prototype.onNodeCreated!.call(node)
    expect(() => buttons[0].callback()).not.toThrow()
    expect(node.setDirtyCanvas).not.toHaveBeenCalled()
  })
})
