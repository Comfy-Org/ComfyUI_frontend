import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { defineNodeExtension } from './index'
import type { NodeHandle } from './node'

function mockNode(comfyClass = 'KSampler') {
  return createMockLGraphNode({
    id: toNodeId('7'),
    comfyClass,
    size: [100, 50]
  })
}

describe('defineNodeExtension', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('registers an extension via app.registerExtension', () => {
    const register = vi
      .spyOn(app, 'registerExtension')
      .mockImplementation(() => undefined)

    defineNodeExtension({ name: 'test.ext', nodeCreated() {} })

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test.ext' })
    )
  })

  it('delivers a NodeHandle (not the raw LGraphNode) to nodeCreated', () => {
    let delivered: NodeHandle | undefined
    vi.spyOn(app, 'registerExtension').mockImplementation((ext) => {
      ext.nodeCreated?.(mockNode(), app)
      return undefined as never
    })

    defineNodeExtension({
      name: 'test.ext',
      nodeCreated(node) {
        delivered = node
      }
    })

    expect(delivered).toBeDefined()
    expect(delivered!.id).toBe('7')
    expect(delivered!.type).toBe('KSampler')
    expect(typeof delivered!.setSize).toBe('function')
  })

  it('honors the nodeTypes filter', () => {
    vi.spyOn(app, 'registerExtension').mockImplementation((ext) => {
      ext.nodeCreated?.(mockNode('CLIPTextEncode'), app)
      return undefined as never
    })
    const nodeCreated = vi.fn()

    defineNodeExtension({
      name: 'test.ext',
      nodeTypes: ['KSampler'],
      nodeCreated
    })

    expect(nodeCreated).not.toHaveBeenCalled()
  })
})
