import { describe, expect, it } from 'vitest'

import type { DocumentViewBinding } from '@/core/graph/document/activationCoordinator'
import { createActivationCoordinator } from '@/core/graph/document/activationCoordinator'
import type { DocumentId } from '@/types/documentId'
import { toDocumentId } from '@/types/documentId'

function recordingBinding(log: string[], name: string): DocumentViewBinding {
  return {
    attach: (id: DocumentId) => log.push(`attach:${name}:${id}`),
    detach: (id: DocumentId) => log.push(`detach:${name}:${id}`)
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('createActivationCoordinator', () => {
  it('activates a loaded document and publishes it as active', async () => {
    const coordinator = createActivationCoordinator({ isLoaded: () => true })
    const log: string[] = []
    const docA = toDocumentId('doc-a')

    const outcome = await coordinator.activate(docA, recordingBinding(log, 'a'))

    expect(outcome).toEqual({ status: 'activated', documentId: docA })
    expect(coordinator.activeDocumentId()).toBe(docA)
    expect(log).toEqual([`attach:a:${docA}`])
  })

  it('rejects activation of a document that is not loaded', async () => {
    const coordinator = createActivationCoordinator({ isLoaded: () => false })
    const log: string[] = []
    const docA = toDocumentId('doc-a')

    const outcome = await coordinator.activate(docA, recordingBinding(log, 'a'))

    expect(outcome).toEqual({
      status: 'rejected',
      documentId: docA,
      reason: 'not-loaded'
    })
    expect(coordinator.activeDocumentId()).toBeNull()
    expect(log).toEqual([])
  })

  it('rejects when hydration fails and leaves the previous binding intact', async () => {
    const docA = toDocumentId('doc-a')
    const docB = toDocumentId('doc-b')
    const coordinator = createActivationCoordinator({
      isLoaded: () => true,
      hydrate: (id) =>
        id === docB ? Promise.reject(new Error('boom')) : Promise.resolve()
    })
    const log: string[] = []
    await coordinator.activate(docA, recordingBinding(log, 'a'))

    const outcome = await coordinator.activate(docB, recordingBinding(log, 'b'))

    expect(outcome).toEqual({
      status: 'rejected',
      documentId: docB,
      reason: 'hydration-failed'
    })
    expect(coordinator.activeDocumentId()).toBe(docA)
    expect(log).toEqual([`attach:a:${docA}`])
  })

  it('performs an ordered detach-then-attach handoff between documents', async () => {
    const coordinator = createActivationCoordinator({ isLoaded: () => true })
    const log: string[] = []
    const docA = toDocumentId('doc-a')
    const docB = toDocumentId('doc-b')

    await coordinator.activate(docA, recordingBinding(log, 'a'))
    await coordinator.activate(docB, recordingBinding(log, 'b'))

    expect(log).toEqual([
      `attach:a:${docA}`,
      `detach:a:${docA}`,
      `attach:b:${docB}`
    ])
    expect(coordinator.activeDocumentId()).toBe(docB)
  })

  it('supersedes a slow activate when a newer activate wins the race', async () => {
    const slowHydration = deferred()
    const docA = toDocumentId('doc-a')
    const docB = toDocumentId('doc-b')
    const coordinator = createActivationCoordinator({
      isLoaded: () => true,
      hydrate: (id) => (id === docA ? slowHydration.promise : Promise.resolve())
    })
    const log: string[] = []

    const first = coordinator.activate(docA, recordingBinding(log, 'a'))
    const second = await coordinator.activate(docB, recordingBinding(log, 'b'))
    slowHydration.resolve()
    const firstOutcome = await first

    expect(second).toEqual({ status: 'activated', documentId: docB })
    expect(firstOutcome).toEqual({ status: 'superseded', documentId: docA })
    expect(coordinator.activeDocumentId()).toBe(docB)
    expect(log).toEqual([`attach:b:${docB}`])
  })

  it('reports superseded when a stale request fails hydration after being overtaken', async () => {
    const slowHydration = deferred()
    const docA = toDocumentId('doc-a')
    const docB = toDocumentId('doc-b')
    const coordinator = createActivationCoordinator({
      isLoaded: () => true,
      hydrate: (id) =>
        id === docA
          ? slowHydration.promise.then(() => {
              throw new Error('late failure')
            })
          : Promise.resolve()
    })
    const log: string[] = []

    const first = coordinator.activate(docA, recordingBinding(log, 'a'))
    await coordinator.activate(docB, recordingBinding(log, 'b'))
    slowHydration.resolve()

    expect(await first).toEqual({ status: 'superseded', documentId: docA })
    expect(coordinator.activeDocumentId()).toBe(docB)
  })

  it('deactivate detaches the active document and cancels in-flight activation', async () => {
    const slowHydration = deferred()
    const docA = toDocumentId('doc-a')
    const docB = toDocumentId('doc-b')
    const coordinator = createActivationCoordinator({
      isLoaded: () => true,
      hydrate: (id) => (id === docB ? slowHydration.promise : Promise.resolve())
    })
    const log: string[] = []
    await coordinator.activate(docA, recordingBinding(log, 'a'))

    const inFlight = coordinator.activate(docB, recordingBinding(log, 'b'))
    expect(coordinator.deactivate(docA)).toBe(true)
    slowHydration.resolve()

    expect(await inFlight).toEqual({ status: 'superseded', documentId: docB })
    expect(coordinator.activeDocumentId()).toBeNull()
    expect(log).toEqual([`attach:a:${docA}`, `detach:a:${docA}`])
  })

  it('rejects with handoff-failed and clears active when attach throws', async () => {
    const coordinator = createActivationCoordinator({ isLoaded: () => true })
    const log: string[] = []
    const docA = toDocumentId('doc-a')
    const docB = toDocumentId('doc-b')
    await coordinator.activate(docA, recordingBinding(log, 'a'))

    const throwingBinding: DocumentViewBinding = {
      attach: () => {
        throw new Error('attach boom')
      },
      detach: (id) => log.push(`detach:b:${id}`)
    }
    const outcome = await coordinator.activate(docB, throwingBinding)

    expect(outcome).toEqual({
      status: 'rejected',
      documentId: docB,
      reason: 'handoff-failed'
    })
    expect(coordinator.activeDocumentId()).toBeNull()
    // The previous document was detached exactly once before the failure.
    expect(log).toEqual([`attach:a:${docA}`, `detach:a:${docA}`])
  })

  it('does not detach the previous document twice after a throwing detach', async () => {
    const coordinator = createActivationCoordinator({ isLoaded: () => true })
    const log: string[] = []
    const docA = toDocumentId('doc-a')
    const docB = toDocumentId('doc-b')
    const throwingDetach: DocumentViewBinding = {
      attach: (id) => log.push(`attach:a:${id}`),
      detach: () => {
        throw new Error('detach boom')
      }
    }
    await coordinator.activate(docA, throwingDetach)

    const outcome = await coordinator.activate(docB, recordingBinding(log, 'b'))

    expect(outcome).toEqual({
      status: 'rejected',
      documentId: docB,
      reason: 'handoff-failed'
    })
    expect(coordinator.activeDocumentId()).toBeNull()

    // A follow-up activate succeeds without re-detaching the failed binding.
    const retry = await coordinator.activate(docB, recordingBinding(log, 'b'))
    expect(retry).toEqual({ status: 'activated', documentId: docB })
    expect(log).toEqual([`attach:a:${docA}`, `attach:b:${docB}`])
  })

  it('deactivate of a non-active document is a no-op', async () => {
    const coordinator = createActivationCoordinator({ isLoaded: () => true })
    const log: string[] = []
    const docA = toDocumentId('doc-a')
    const docB = toDocumentId('doc-b')
    await coordinator.activate(docA, recordingBinding(log, 'a'))

    expect(coordinator.deactivate(docB)).toBe(false)
    expect(coordinator.activeDocumentId()).toBe(docA)
  })
})
