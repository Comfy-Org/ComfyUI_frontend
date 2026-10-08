import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import type { useExtensionService } from '@/services/extensionService'

const { invokeExtensionsAsync } = vi.hoisted(() => ({
  invokeExtensionsAsync: vi.fn()
}))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      invokeExtensionsAsync
    })
}))

function makeDefs(count: number) {
  const defs: Record<string, ComfyNodeDefV1> = {}
  for (let i = 0; i < count; i++) {
    defs[`Node${i}`] = { name: `Node${i}` } as ComfyNodeDefV1
  }
  return defs
}

describe('ComfyApp.registerNodesFromDefs', () => {
  it('registers every def in order after the addCustomNodeDefs hook', async () => {
    const events: string[] = []
    invokeExtensionsAsync.mockImplementation(async (method) => {
      events.push(`hook:${method}`)
      return []
    })
    vi.spyOn(app, 'registerNodeDef').mockImplementation(async (nodeId) => {
      events.push(nodeId)
    })
    const defs = makeDefs(600)

    await app.registerNodesFromDefs(defs)

    expect(events[0]).toBe('hook:addCustomNodeDefs')
    expect(events.slice(1)).toEqual(Object.keys(defs))
  })

  it('never has more than one chunk of defs in flight, but overlaps within it', async () => {
    let inFlight = 0
    let maxInFlight = 0
    vi.spyOn(app, 'registerNodeDef').mockImplementation(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight--
    })

    await app.registerNodesFromDefs(makeDefs(1000))

    expect(maxInFlight).toBeGreaterThan(1)
    expect(maxInFlight).toBeLessThanOrEqual(256)
  })

  it('still registers the remaining defs when one rejects, then rethrows the first error', async () => {
    const registered: string[] = []
    vi.spyOn(app, 'registerNodeDef').mockImplementation(async (nodeId) => {
      registered.push(nodeId)
      if (nodeId === 'Node3') throw new Error('first')
      if (nodeId === 'Node400') throw new Error('second')
    })
    const defs = makeDefs(600)

    await expect(app.registerNodesFromDefs(defs)).rejects.toThrow('first')

    expect(registered).toEqual(Object.keys(defs))
  })

  it('does nothing for an empty def set', async () => {
    const register = vi.spyOn(app, 'registerNodeDef')

    await app.registerNodesFromDefs({})

    expect(register).not.toHaveBeenCalled()
  })
})
