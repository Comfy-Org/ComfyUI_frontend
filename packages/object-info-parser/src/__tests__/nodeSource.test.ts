import { describe, expect, it } from 'vitest'

import {
  NodeSourceType,
  getNodeSource,
  isCustomNode
} from '../classifiers/nodeSource'
import type { NodeSource } from '../classifiers/nodeSource'

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

  it('should return UNKNOWN_NODE_SOURCE for custom_nodes with no pack segment', () => {
    expect(getNodeSource('custom_nodes').type).toBe(NodeSourceType.Unknown)
  })

  it('should strip ComfyUI- and -ComfyUI prefixes/suffixes from custom pack names', () => {
    expect(getNodeSource('custom_nodes.ComfyUI-foo').displayText).toBe('foo')
    expect(getNodeSource('custom_nodes.bar-ComfyUI').displayText).toBe('bar')
    expect(getNodeSource('custom_nodes.Comfy_baz').displayText).toBe('baz')
  })

  describe('blueprint nodes', () => {
    it('should identify blueprint nodes', () => {
      const result = getNodeSource('blueprint.my_blueprint')
      expect(result).toEqual({
        type: NodeSourceType.Blueprint,
        className: 'blueprint',
        displayText: 'Blueprint',
        badgeText: 'bp'
      })
    })
  })
})

function makeNode(type: NodeSourceType): { nodeSource: NodeSource } {
  return {
    nodeSource: {
      type,
      className: '',
      displayText: '',
      badgeText: ''
    }
  }
}

describe('isCustomNode', () => {
  it('returns true for CustomNodes', () => {
    expect(isCustomNode(makeNode(NodeSourceType.CustomNodes))).toBe(true)
  })

  it.for([
    NodeSourceType.Core,
    NodeSourceType.Unknown,
    NodeSourceType.Blueprint
  ])('returns false for %s nodes', (type) => {
    expect(isCustomNode(makeNode(type))).toBe(false)
  })
})
