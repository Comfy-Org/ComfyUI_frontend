import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { useExtensionService } from '@/services/extensionService'
import type { ComfyExtension } from '@/types/comfy'

const { registered } = vi.hoisted(() => ({
  registered: [] as ComfyExtension[]
}))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: (extension: ComfyExtension) => {
        registered.push(extension)
      }
    })
}))

await import('./lightInfo')

class CreateLightInfoNode extends LGraphNode {
  static comfyClass = 'CreateLightInfo'
}

class OtherNode extends LGraphNode {
  static comfyClass = 'SomethingElse'
}

describe('Comfy.CreateLightInfo extension', () => {
  it.for([
    {
      label: 'grows a small light node to fit the editor',
      NodeClass: CreateLightInfoNode,
      size: [200, 100],
      expected: [360, 580]
    },
    {
      label: 'keeps a light node that is already larger',
      NodeClass: CreateLightInfoNode,
      size: [500, 700],
      expected: [500, 700]
    },
    {
      label: 'leaves other node types alone',
      NodeClass: OtherNode,
      size: [200, 100],
      expected: [200, 100]
    }
  ])('$label', ({ NodeClass, size, expected }) => {
    const extension = registered.find((e) => e.name === 'Comfy.CreateLightInfo')
    assert.exists(extension?.nodeCreated)
    const node = new NodeClass('Node')
    node.size = [size[0], size[1]]

    extension.nodeCreated(node, fromAny({}))

    expect([node.size[0], node.size[1]]).toEqual(expected)
  })
})
