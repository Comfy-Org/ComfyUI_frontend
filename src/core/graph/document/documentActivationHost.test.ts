import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDocumentId } from '@/types/documentId'
import type { DocumentId } from '@/types/documentId'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'

import { createDocumentActivationHost } from './documentActivationHost'
import type { DocumentActivationHost } from './documentActivationHost'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

function scopeOf(rootGraphId: string): GraphScope {
  return {
    rootGraphId: toRootGraphId(rootGraphId),
    owningGraphId: toOwningGraphId(rootGraphId)
  }
}

describe('createDocumentActivationHost', () => {
  let host: DocumentActivationHost
  let loaded: Set<DocumentId>
  let boundScopes: { documentId: DocumentId; scope: GraphScope }[]
  let tabA: DocumentId
  let tabB: DocumentId

  beforeEach(() => {
    tabA = createDocumentId()
    tabB = createDocumentId()
    loaded = new Set([tabA, tabB])
    boundScopes = []
    host = createDocumentActivationHost({
      isLoaded: (documentId) => loaded.has(documentId),
      bindScope: (documentId, scope) => boundScopes.push({ documentId, scope })
    })
  })

  it('publishes nothing before the first activation', () => {
    expect(host.activeDocumentId()).toBeNull()
    expect(host.activeRootGraphId()).toBeNull()
  })

  it('publishes the activated document and the graph its canvas holds', async () => {
    await host.activate(tabA, scopeOf('graph-a'))

    expect(host.activeDocumentId()).toBe(tabA)
    expect(host.activeRootGraphId()).toBe(toRootGraphId('graph-a'))
  })

  it('records the scope in the registry before the handoff', async () => {
    await host.activate(tabA, scopeOf('graph-a'))

    expect(boundScopes).toEqual([
      { documentId: tabA, scope: scopeOf('graph-a') }
    ])
  })

  it('a tab switch deactivates the outgoing document and activates the incoming one', async () => {
    await host.activate(tabA, scopeOf('graph-a'))

    host.deactivate()
    expect(host.activeDocumentId()).toBeNull()
    expect(host.activeRootGraphId()).toBeNull()

    await host.activate(tabB, scopeOf('graph-b'))

    expect(host.activeDocumentId()).toBe(tabB)
    expect(host.activeRootGraphId()).toBe(toRootGraphId('graph-b'))
  })

  it('leaves nothing published while the shared graph is being reconfigured', async () => {
    await host.activate(tabA, scopeOf('graph-a'))

    // The window the tab-switch race lives in: the outgoing binding is gone
    // before the incoming one exists, so a change draining in between can
    // name neither document.
    host.deactivate()

    expect(host.activeRootGraphId()).toBeNull()
  })

  it('rebinds the same document when its graph id rotates in place', async () => {
    await host.activate(tabA, scopeOf('graph-a'))
    host.deactivate()
    await host.activate(tabA, scopeOf('graph-a-reminted'))

    expect(host.activeRootGraphId()).toBe(toRootGraphId('graph-a-reminted'))
  })

  it('refuses to activate a document the registry has not loaded', async () => {
    loaded.delete(tabB)

    const outcome = await host.activate(tabB, scopeOf('graph-b'))

    expect(outcome).toEqual({
      status: 'rejected',
      documentId: tabB,
      reason: 'not-loaded'
    })
    expect(host.activeRootGraphId()).toBeNull()
  })

  it('deactivate is inert when no document holds the canvas', () => {
    expect(() => host.deactivate()).not.toThrow()
    expect(host.activeDocumentId()).toBeNull()
  })

  it('deactivate cancels an activation that is still mid-handoff', async () => {
    const inFlight = host.activate(tabA, scopeOf('graph-a'))
    host.deactivate()

    await expect(inFlight).resolves.toEqual({
      status: 'superseded',
      documentId: tabA
    })
    expect(host.activeRootGraphId()).toBeNull()
  })

  it('deactivate retracts the published binding and the in-flight one together', async () => {
    await host.activate(tabA, scopeOf('graph-a'))
    const inFlight = host.activate(tabB, scopeOf('graph-b'))

    host.deactivate()
    await inFlight

    expect(host.activeDocumentId()).toBeNull()
    expect(host.activeRootGraphId()).toBeNull()
  })

  it('rapid switching settles on the last request, not the last to resolve', async () => {
    const switches = [
      host.activate(tabA, scopeOf('graph-a')),
      host.activate(tabB, scopeOf('graph-b')),
      host.activate(tabA, scopeOf('graph-a')),
      host.activate(tabB, scopeOf('graph-b'))
    ]
    const outcomes = await Promise.all(switches)

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'superseded',
      'superseded',
      'superseded',
      'activated'
    ])
    expect(host.activeDocumentId()).toBe(tabB)
    expect(host.activeRootGraphId()).toBe(toRootGraphId('graph-b'))
  })

  it('a superseded activation never leaves its graph published', async () => {
    const stale = host.activate(tabA, scopeOf('graph-a'))
    const winner = host.activate(tabB, scopeOf('graph-b'))
    await Promise.all([stale, winner])

    expect(host.activeRootGraphId()).toBe(toRootGraphId('graph-b'))
  })
})
