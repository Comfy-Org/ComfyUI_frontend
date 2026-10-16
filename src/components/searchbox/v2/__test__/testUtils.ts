import type { DetachedWindowAPI } from 'happy-dom'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'

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
  const happyDOM = (window as unknown as { happyDOM?: DetachedWindowAPI })
    .happyDOM
  if (!happyDOM) {
    throw new Error('window.happyDOM is unavailable to set viewport')
  }
  happyDOM.setViewport(viewport)
}
