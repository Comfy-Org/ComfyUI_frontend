import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

setActivePinia(createTestingPinia())

function testNode() {
  const node = new LGraphNode('test')
  node.widgets = []
  return node as LGraphNode & Required<Pick<LGraphNode, 'widgets'>>
}

describe('malformed COMFY_MATCHTYPE_V3 spec', () => {
  it('still exposes the input instead of dropping it silently', () => {
    const { addNodeInput } = useLitegraphService()
    const node = testNode()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const malformed: InputSpec = [
      'COMFY_MATCHTYPE_V3',
      { template: { allowed_types: 'IMAGE' } }
    ]
    addNodeInput(
      node,
      transformInputSpecV1ToV2(malformed, { name: 'value', isOptional: false })
    )

    expect(node.inputs.map((i) => i.name)).toEqual(['value'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
