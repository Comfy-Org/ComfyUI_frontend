import { describe, expect, it } from 'vitest'

import { extractCustomNodeName, getNodeHelpBaseUrl } from './nodeHelpUtil'

function nodeDef(name: string, python_module: string) {
  return { name, python_module }
}

describe('nodeHelpUtil', () => {
  it('extracts normalized custom node package names', () => {
    expect(
      extractCustomNodeName('custom_nodes.ComfyUI-TestPack@1_2_3.nodes')
    ).toBe('ComfyUI-TestPack')
    expect(extractCustomNodeName('nodes')).toBeNull()
    expect(extractCustomNodeName(undefined)).toBeNull()
  })

  it('returns base URLs for blueprint, custom, and core nodes', () => {
    expect(
      getNodeHelpBaseUrl(nodeDef('SubgraphBlueprint.Test', 'blueprint'))
    ).toBe('')
    expect(
      getNodeHelpBaseUrl(nodeDef('CustomNode', 'custom_nodes.TestPack.nodes'))
    ).toBe('/extensions/TestPack/docs/')
    expect(getNodeHelpBaseUrl(nodeDef('LoadImage', 'nodes'))).toBe(
      '/docs/LoadImage/'
    )
    expect(getNodeHelpBaseUrl(nodeDef('UnknownNode', 'custom_nodes'))).toBe(
      '/docs/UnknownNode/'
    )
  })
})
