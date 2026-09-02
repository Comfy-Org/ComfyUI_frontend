import {
  appliedOpIds,
  mint,
  NODE_INCARNATION_KEY,
  nodesMap,
  readStamps
} from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createActivationCoordinator } from '@/core/graph/document/activationCoordinator'
import type { DocumentViewBinding } from '@/core/graph/document/activationCoordinator'
import { createDetachedTargetSession } from '@/core/graph/document/detachedTargetSession'
import type { DetachedTargetSession } from '@/core/graph/document/detachedTargetSession'
import { serializeDocumentScope } from '@/core/graph/document/documentSerializer'
import { createGraphMutations } from '@/core/graph/graphMutations'
import type { GraphMutations } from '@/core/graph/graphMutations'
import { useGraphDocumentStore } from '@/stores/graphDocumentStore'
import type { DocumentId } from '@/types/documentId'
import type { GraphScope } from '@/types/graphScopeId'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'

import { createTargetFrameApplyPort } from './targetFrameProjection'

const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: ['seed', 'stale'] },
    Sink: { widget_order: [] }
  }
}

const workflowJson = {
  nodes: [
    {
      id: 1,
      type: 'Source',
      title: 'Producer',
      pos: [10, 20],
      size: [180, 90],
      inputs: [],
      outputs: [{ name: 'out', type: 'IMAGE', links: [9] }],
      widgets_values: { seed: 42, stale: 7 }
    },
    {
      id: 2,
      type: 'Sink',
      pos: [300, 20],
      inputs: [{ name: 'in', type: 'IMAGE', link: 9 }],
      outputs: []
    }
  ],
  links: [[9, 1, 0, 2, 0, 'IMAGE']] as [
    number,
    number,
    number,
    number,
    number,
    string
  ][]
}

function scopeFor(graphId: string): GraphScope {
  return {
    rootGraphId: toRootGraphId(graphId),
    owningGraphId: toOwningGraphId(graphId)
  }
}

function mutationsFor(scope: GraphScope): GraphMutations {
  return createGraphMutations({
    getScope: () => scope,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
}

function commitHostState(
  session: DetachedTargetSession,
  workflowId: string,
  host: Y.Doc,
  mutations: GraphMutations,
  seq = 1
): void {
  expect(
    session.enqueue({
      workflowId,
      seq,
      update: Y.encodeStateAsUpdate(host),
      actor: 'agent:test',
      opIds: [`bootstrap-${seq}`]
    }).status
  ).toBe('queued')
  expect(session.commitNext(createTargetFrameApplyPort(mutations)).status).toBe(
    'committed'
  )
}

/** A fake renderer-mode binding: activation must never touch semantic state. */
function modeBinding(log: string[], mode: string): DocumentViewBinding {
  return {
    attach: () => log.push(`attach:${mode}`),
    detach: () => log.push(`detach:${mode}`)
  }
}

function registerLoadedDocument(workflowId: string, scope: GraphScope) {
  const registry = useGraphDocumentStore()
  const documentId = registry.createDocument({ workflowId })
  if (documentId === null) throw new Error('duplicate workflow mapping')
  expect(registry.hydrateDocument(documentId, scope)).toBe(true)
  return { registry, documentId }
}

function loadedCoordinator() {
  const registry = useGraphDocumentStore()
  return createActivationCoordinator({
    isLoaded: (id: DocumentId) =>
      registry.getDocument(id)?.state.phase === 'loaded'
  })
}

describe('document activation persistence (ADR-0024 seam)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('serializes byte-identically across Base/ECS/Nodes-2.0 activation cycles and save/reload', async () => {
    const scope = scopeFor('root')
    const mutations = mutationsFor(scope)
    const host = mint(workflowJson, catalog)
    const session = createDetachedTargetSession('wf')
    commitHostState(session, 'wf', host, mutations)

    const baseline = serializeDocumentScope(scope)
    expect(baseline.length).toBeGreaterThan(2)

    const { registry, documentId } = registerLoadedDocument('wf', scope)
    const coordinator = loadedCoordinator()
    const log: string[] = []

    for (const mode of ['base', 'ecs', 'nodes2']) {
      const outcome = await coordinator.activate(
        documentId,
        modeBinding(log, mode)
      )
      expect(outcome.status).toBe('activated')
      expect(serializeDocumentScope(scope)).toEqual(baseline)
      expect(coordinator.deactivate(documentId)).toBe(true)
      expect(serializeDocumentScope(scope)).toEqual(baseline)
    }
    expect(log).toEqual([
      'attach:base',
      'detach:base',
      'attach:ecs',
      'detach:ecs',
      'attach:nodes2',
      'detach:nodes2'
    ])

    expect(registry.markMutated(documentId)).toBe(true)
    const ticket = registry.beginSave(documentId)
    expect(ticket).not.toBeNull()
    const savedBytes = serializeDocumentScope(scope)
    expect(registry.markMutated(documentId)).toBe(true)
    expect(registry.completeSave(ticket!)).toBe(true)
    expect(registry.persistenceStateOf(documentId)).toBe('dirty')

    const reloadSession = createDetachedTargetSession('wf')
    reloadSession.enqueue({
      workflowId: 'wf',
      seq: 1,
      update: session.encodeCommittedState()
    })
    expect(
      reloadSession.commitNext(createTargetFrameApplyPort(mutations)).status
    ).toBe('committed')

    expect(serializeDocumentScope(scope)).toEqual(savedBytes)
    expect(serializeDocumentScope(scope)).toEqual(baseline)

    session.destroy()
    reloadSession.destroy()
    host.destroy()
  })

  it('reloads byte-identically while a different renderer mode is active', async () => {
    const scope = scopeFor('root')
    const mutations = mutationsFor(scope)
    const host = mint(workflowJson, catalog)
    const session = createDetachedTargetSession('wf')
    commitHostState(session, 'wf', host, mutations)
    const baseline = serializeDocumentScope(scope)

    const otherScope = scopeFor('other-root')
    const { documentId: otherDocumentId } = registerLoadedDocument(
      'wf-other',
      otherScope
    )
    const coordinator = loadedCoordinator()
    await coordinator.activate(otherDocumentId, modeBinding([], 'nodes2'))

    const reloadSession = createDetachedTargetSession('wf')
    reloadSession.enqueue({
      workflowId: 'wf',
      seq: 1,
      update: session.encodeCommittedState()
    })
    expect(
      reloadSession.commitNext(createTargetFrameApplyPort(mutations)).status
    ).toBe('committed')

    expect(serializeDocumentScope(scope)).toEqual(baseline)
    expect(coordinator.activeDocumentId()).toBe(otherDocumentId)

    session.destroy()
    reloadSession.destroy()
    host.destroy()
  })

  it('preserves original stamps and DQ-11(c) node incarnations through the staged commit path', () => {
    const scope = scopeFor('root')
    const mutations = mutationsFor(scope)
    const host = mint(workflowJson, catalog)
    const session = createDetachedTargetSession('wf')
    commitHostState(session, 'wf', host, mutations)

    const committed = new Y.Doc()
    Y.applyUpdate(committed, session.encodeCommittedState())

    expect(readStamps(committed)).toEqual(readStamps(host))
    expect([...appliedOpIds(committed)].sort()).toEqual(
      [...appliedOpIds(host)].sort()
    )
    for (const id of ['1', '2']) {
      const hostIncarnation = nodesMap(host).get(id)?.get(NODE_INCARNATION_KEY)
      expect(typeof hostIncarnation).toBe('string')
      expect(nodesMap(committed).get(id)?.get(NODE_INCARNATION_KEY)).toBe(
        hostIncarnation
      )
    }

    committed.destroy()
    session.destroy()
    host.destroy()
  })

  it('isolates agent frames from the active canvas: frames land in their registry-resolved scope only', async () => {
    const scopeA = scopeFor('root-a')
    const scopeB = scopeFor('root-b')
    const mutationsA = mutationsFor(scopeA)
    const mutationsB = mutationsFor(scopeB)

    const hostA = mint(workflowJson, catalog)
    const sessionA = createDetachedTargetSession('wf-a')
    commitHostState(sessionA, 'wf-a', hostA, mutationsA)
    const bytesA = serializeDocumentScope(scopeA)

    const registryA = registerLoadedDocument('wf-a', scopeA)
    const registryB = registerLoadedDocument('wf-b', scopeB)
    const registry = useGraphDocumentStore()

    const coordinator = loadedCoordinator()
    await coordinator.activate(registryA.documentId, modeBinding([], 'base'))

    const target = registry.resolveWorkflowTarget('wf-b')
    expect(target?.documentId).toBe(registryB.documentId)
    expect(target?.scope).toEqual(scopeB)
    expect(target?.documentId).not.toBe(coordinator.activeDocumentId())

    const hostB = mint({ nodes: [workflowJson.nodes[1]!], links: [] }, catalog)
    const sessionB = createDetachedTargetSession('wf-b')
    commitHostState(sessionB, 'wf-b', hostB, mutationsB)

    expect(serializeDocumentScope(scopeA)).toEqual(bytesA)
    expect(serializeDocumentScope(scopeB)).not.toEqual(bytesA)

    sessionA.destroy()
    sessionB.destroy()
    hostA.destroy()
    hostB.destroy()
  })

  it('recovers a detached target across reconnect via the last committed state vector', () => {
    const scope = scopeFor('root')
    const mutations = mutationsFor(scope)
    const host = mint(workflowJson, catalog)
    const session = createDetachedTargetSession('wf')
    commitHostState(session, 'wf', host, mutations)
    const baseline = serializeDocumentScope(scope)

    const beforeMissed = Y.encodeStateVector(host)
    nodesMap(host).get('1')?.set('title', 'Renamed while offline')
    const missedFrame = {
      workflowId: 'wf',
      seq: 2,
      update: Y.encodeStateAsUpdate(host, beforeMissed)
    }
    nodesMap(host).get('1')?.set('color', '#123456')

    expect(session.enqueue(missedFrame).status).toBe('queued')
    const gap = session.enqueue({
      workflowId: 'wf',
      seq: 4,
      update: Y.encodeStateAsUpdate(host, Y.encodeStateVector(host))
    })
    expect(gap.status).toBe('gap')
    expect(serializeDocumentScope(scope)).toEqual(baseline)

    session.beginResync()
    session.enqueue({
      workflowId: 'wf',
      seq: 4,
      update: Y.encodeStateAsUpdate(host, session.recoveryStateVector())
    })
    expect(
      session.commitNext(createTargetFrameApplyPort(mutations)).status
    ).toBe('committed')

    const committed = new Y.Doc()
    Y.applyUpdate(committed, session.encodeCommittedState())
    expect(nodesMap(committed).toJSON()).toEqual(nodesMap(host).toJSON())
    committed.destroy()

    expect(serializeDocumentScope(scope)).not.toEqual(baseline)

    session.destroy()
    host.destroy()
  })

  it('doc_reset starts a new lineage whose fresh mint replaces the scope content', () => {
    const scope = scopeFor('root')
    const mutations = mutationsFor(scope)
    const host = mint(workflowJson, catalog)
    const session = createDetachedTargetSession('wf')
    commitHostState(session, 'wf', host, mutations)
    const oldLineage = session.snapshot().lineage

    session.resetLineage(10)
    expect(session.snapshot().lineage).not.toBe(oldLineage)

    const remintedHost = mint(
      { nodes: [workflowJson.nodes[0]!], links: [] },
      catalog
    )
    commitHostState(session, 'wf', remintedHost, mutations, 11)

    const committed = new Y.Doc()
    Y.applyUpdate(committed, session.encodeCommittedState())
    expect([...nodesMap(committed).keys()]).toEqual(['1'])
    committed.destroy()

    const reloaded = serializeDocumentScope(scope)
    const parsed = JSON.parse(new TextDecoder().decode(reloaded)) as {
      nodes: { id: string }[]
      links: unknown[]
    }
    expect(parsed.nodes.map(({ id }) => id)).toEqual(['1'])
    expect(parsed.links).toEqual([])

    session.destroy()
    host.destroy()
    remintedHost.destroy()
  })
})
