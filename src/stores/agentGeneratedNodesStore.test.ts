import { describe, expect, it } from 'vitest'

import { useAgentGeneratedNodesStore } from '@/stores/agentGeneratedNodesStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { createNodeLocatorId } from '@/types/nodeIdentification'

function locator(id: number): NodeLocatorId {
  const locatorId = createNodeLocatorId(null, toNodeId(id))
  if (!locatorId) throw new Error(`no locator for node ${id}`)
  return locatorId
}

describe('agentGeneratedNodesStore', () => {
  it('spaces a cascade so a workflow that lands at once pops in sequence', () => {
    const store = useAgentGeneratedNodesStore()
    const landed = Date.now()

    for (const id of [1, 2, 3])
      store.markGenerated(locator(id), { at: landed, cascade: true })

    const stamps = [1, 2, 3].map((id) => store.generatedAtFor(locator(id)))
    expect(stamps[0]).toBe(landed)
    expect(stamps).toStrictEqual([...stamps].sort((a = 0, b = 0) => a - b))
    expect(new Set(stamps).size).toBe(3)
  })

  it('stamps nodes added to a graph as they land', () => {
    const store = useAgentGeneratedNodesStore()
    const landed = Date.now()

    for (const id of [1, 2, 3]) store.markGenerated(locator(id), { at: landed })

    const stamps = [1, 2, 3].map((id) => store.generatedAtFor(locator(id)))
    expect(stamps).toStrictEqual([landed, landed, landed])
  })

  it('leaves a cascade past nodes that arrive later on their own time', () => {
    const store = useAgentGeneratedNodesStore()
    const landed = Date.now()

    store.markGenerated(locator(1), { at: landed, cascade: true })
    store.markGenerated(locator(2), { at: landed + 500, cascade: true })

    expect(store.generatedAtFor(locator(2))).toBe(landed + 500)
  })
})
