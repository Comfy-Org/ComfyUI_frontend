import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { expect, test as baseTest } from 'vitest'
import * as Y from 'yjs'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { graphScopeOf } from '@/types/graphScopeId'

import { reconcileAgentAdapters } from '../agentNodeMaterializer'
import { EcsFollowerAdapter } from '../ecsFollowerAdapter'
import { FollowerDoc } from '../followerDoc'
import { createGraphMutations } from '../graphMutations'
import type { GraphOperation } from '../graphOperations'
import { attachMintPortWiring } from '../mintPortWiring'
import { inertPlacementPort } from './inertPlacementPort'

interface SessionOptions {
  workflowId: string
  seed: WorkflowJSON
  catalog: WidgetCatalog
}

interface CrdtSession {
  graph: LGraph
  host: Y.Doc
  follower: FollowerDoc
  minted: GraphOperation[]
  deliver(): void
  applyAgent(operations: GraphOperation[]): void
}

interface CrdtFixtures {
  createCrdtSession(options: SessionOptions): CrdtSession
}

export type CreateCrdtSession = CrdtFixtures['createCrdtSession']

/**
 * Runs every cleanup in `cleanups`, in reverse registration order, even
 * when an earlier one throws -- a broken detach/destroy must not skip the
 * rest and leak state into later tests. A single thrown error is rethrown
 * unchanged, so a test that owns just one failing cleanup still sees its
 * own error; more than one is aggregated into an `AggregateError` so none
 * of the causes are silently dropped. See `crdtSession.test.ts` for the
 * focused regression coverage on this behavior.
 */
export function runCleanupsInReverse(
  cleanups: readonly (() => void)[],
  aggregateMessage = '[agent-crdt] fixture cleanup failed'
): void {
  const errors: unknown[] = []
  for (const cleanup of [...cleanups].reverse()) {
    try {
      cleanup()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) {
    throw new AggregateError(errors, aggregateMessage)
  }
}

export const crdtTest = baseTest.extend<CrdtFixtures>({
  createCrdtSession: async ({ task }, use) => {
    const cleanups: Array<() => void> = []
    await use(({ workflowId, seed, catalog }) => {
      const graph = new LGraph()
      const previousGraph = app.rootGraph
      Reflect.set(app, 'rootGraph', graph)
      cleanups.push(() => Reflect.set(app, 'rootGraph', previousGraph))

      const host = mint(structuredClone(seed), catalog)
      cleanups.push(() => host.destroy())
      const follower = new FollowerDoc()
      cleanups.push(() => follower.destroy())
      const adapter = new EcsFollowerAdapter(
        createGraphMutations({
          getScope: () => graphScopeOf(graph),
          layout: { createNode: () => {}, deleteNodes: () => {} },
          placement: inertPlacementPort
        })
      )
      adapter.bind(workflowId, follower)
      cleanups.push(() => adapter.destroy())
      const minted: GraphOperation[] = []
      const wiring = attachMintPortWiring({
        isEnabled: () => true,
        isDocBound: () => true,
        enqueue: (operations) => minted.push(...operations),
        layoutChanges: () => () => {},
        localActorPrefix: 'user-',
        getGraph: () => graph,
        boundRootGraphId: () => graphScopeOf(graph).rootGraphId
      })
      cleanups.push(() => wiring.detach())
      let sequence = 0

      return {
        graph,
        host,
        follower,
        minted,
        deliver() {
          const update = Y.encodeStateAsUpdate(host, follower.stateVector())
          follower.applyRemoteUpdate(update)
          expect(
            adapter.applyFrame({ workflowId, seq: ++sequence, update })
          ).toBe(true)
          reconcileAgentAdapters(graph)
        },
        applyAgent(operations) {
          const result = applyOps(
            host,
            operations.map((operation, index) => ({
              ...operation,
              op_id: `op-${sequence}-${index}`,
              actor: 'agent:test',
              base_version: sequence,
              stamp: [sequence, 'agent:test']
            })),
            catalog
          )
          expect(
            result.outcomes.every(({ outcome }) => outcome === 'applied')
          ).toBe(true)
        }
      }
    })

    runCleanupsInReverse(
      cleanups,
      `CRDT session cleanup failed in "${task.name}"`
    )
  }
})
