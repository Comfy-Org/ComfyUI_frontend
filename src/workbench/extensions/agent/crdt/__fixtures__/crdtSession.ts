import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { expect, test as baseTest } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { graphScopeOf } from '@/types/graphScopeId'

import { reconcileAgentAdapters } from '../agentNodeMaterializer'
import { EcsFollowerAdapter, mapLocalInputSlots } from '../ecsFollowerAdapter'
import { FollowerDoc } from '../followerDoc'
import type { GraphOperation, LocalGraphOperation } from '../graphOperations'
import { attachMintPortWiring } from '../mintPortWiring'

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

export const crdtTest = baseTest.extend<CrdtFixtures>({
  createCrdtSession: async ({}, use) => {
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
          layout: { createNode: () => {}, deleteNodes: () => {} }
        })
      )
      adapter.bind(workflowId, follower)
      cleanups.push(() => adapter.destroy())
      const minted: GraphOperation[] = []
      const wiring = attachMintPortWiring({
        isEnabled: () => true,
        isDocBound: () => true,
        enqueue: (operations) =>
          minted.push(
            ...mapLocalInputSlots(
              follower.doc,
              graph,
              operations as LocalGraphOperation[]
            )
          ),
        layoutChanges: () => () => {},
        localActorPrefix: 'user-',
        getGraph: () => graph
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

    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup()
      } catch (error) {
        console.error('[agent-crdt] fixture cleanup failed', error)
      }
    }
  }
})
