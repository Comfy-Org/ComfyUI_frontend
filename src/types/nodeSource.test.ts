import { describe, expect, it } from 'vitest'

import { NodeSourceType, getNodeSource } from '@/types/nodeSource'

describe('getNodeSource', () => {
  it('should return UNKNOWN_NODE_SOURCE when python_module is undefined', () => {
    const result = getNodeSource(undefined)
    expect(result).toEqual({
      type: NodeSourceType.Unknown,
      className: 'comfy-unknown',
      displayText: 'Unknown',
      badgeText: '?'
    })
  })

  it('should identify core nodes from nodes module', () => {
    const result = getNodeSource('nodes.some_module')
    expect(result).toEqual({
      type: NodeSourceType.Core,
      className: 'comfy-core',
      displayText: 'Comfy Core',
      badgeText: '🦊'
    })
  })

  it('should identify core nodes from comfy_extras module', () => {
    const result = getNodeSource('comfy_extras.some_module')
    expect(result).toEqual({
      type: NodeSourceType.Core,
      className: 'comfy-core',
      displayText: 'Comfy Core',
      badgeText: '🦊'
    })
  })

  it('should identify core nodes from comfy_api_nodes module', () => {
    const result = getNodeSource('comfy_api_nodes.some_module')
    expect(result).toEqual({
      type: NodeSourceType.Core,
      className: 'comfy-core',
      displayText: 'Comfy Core',
      badgeText: '🦊'
    })
  })

  it('should identify custom nodes and format their names', () => {
    const result = getNodeSource('custom_nodes.ComfyUI-Example')
    expect(result).toEqual({
      type: NodeSourceType.CustomNodes,
      className: 'comfy-custom-nodes',
      displayText: 'Example',
      badgeText: 'Example'
    })
  })

  it('should identify custom nodes with version and format their names', () => {
    const result = getNodeSource('custom_nodes.ComfyUI-Example@1.0.0')
    expect(result).toEqual({
      type: NodeSourceType.CustomNodes,
      className: 'comfy-custom-nodes',
      displayText: 'Example',
      badgeText: 'Example'
    })
  })

  it('should return UNKNOWN_NODE_SOURCE for unrecognized modules', () => {
    const result = getNodeSource('unknown_module.something')
    expect(result).toEqual({
      type: NodeSourceType.Unknown,
      className: 'comfy-unknown',
      displayText: 'Unknown',
      badgeText: '?'
    })
  })
})
