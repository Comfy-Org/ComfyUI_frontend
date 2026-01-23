import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

describe('nodeHelpStore', () => {
  const mockCoreNode = {
    name: 'TestNode',
    display_name: 'Test Node',
    description: 'A test node',
    inputs: {},
    outputs: [],
    python_module: 'comfy.test_node'
  }

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty state', () => {
    const nodeHelpStore = useNodeHelpStore()
    expect(nodeHelpStore.currentHelpNode).toBeNull()
    expect(nodeHelpStore.isHelpOpen).toBe(false)
  })

  it('should open help for a node', () => {
    const nodeHelpStore = useNodeHelpStore()

    nodeHelpStore.openHelp(mockCoreNode as any)

    expect(nodeHelpStore.currentHelpNode).toStrictEqual(mockCoreNode)
    expect(nodeHelpStore.isHelpOpen).toBe(true)
  })

  it('should close help', () => {
    const nodeHelpStore = useNodeHelpStore()

    nodeHelpStore.openHelp(mockCoreNode as any)
    expect(nodeHelpStore.isHelpOpen).toBe(true)

    nodeHelpStore.closeHelp()
    expect(nodeHelpStore.currentHelpNode).toBeNull()
    expect(nodeHelpStore.isHelpOpen).toBe(false)
  })
})
