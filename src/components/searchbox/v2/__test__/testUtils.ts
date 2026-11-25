import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { setHappyDomViewport } from '@/utils/__tests__/happyDomTestUtils'

export function createMockNodeDef(
  overrides: Partial<ComfyNodeDef> = {}
): ComfyNodeDefImpl {
  return new ComfyNodeDefImpl({
    name: 'TestNode',
    display_name: 'Test Node',
    category: 'test',
    python_module: 'nodes',
    description: 'Test description',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    deprecated: false,
    experimental: false,
    ...overrides
  })
}

export function setViewport(viewport: { width: number; height: number }) {
  setHappyDomViewport(viewport)
}
