import type { ApplyOutcome } from '@comfyorg/comfy-multi-player'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { expect } from '@playwright/test'

// A text-only turn: the follower subscribes to the recorded workflow's doc
// and the agent changes nothing, so every node on the canvas afterwards is
// the seed or what the user adds by hand. Its pinned catalog names
// CLIPTextEncode and KSampler, and no frontend-only class.
const CASE = 'agent-rec-text-only-answer'
// The seed's "Positive prompt" CLIPTextEncode; a host edit to its text is the
// readiness boundary for "the frames pending on the follower have landed".
const PROMPT_NODE_ID = '6'
const PROMPT_WIDGET = 'text'
const ADD_POSITION: [number, number] = [400, 400]

interface AddCase {
  name: string
  add: (agentConversation: AgentConversationHarness) => Promise<string>
}

// KSampler is in the pinned catalog. Note is registered by a frontend
// extension and absent from every catalog, the footing a Get/Set node from a
// custom-node pack stands on. A blueprint host is typed by a definition the
// doc has never seen; it only carries widget values when it promotes one. The
// mint keeps `widgets_values` positional for the uncatalogued classes, the
// form the applier stores opaquely instead of rejecting.
const CATALOGUED: AddCase = {
  name: 'a node from the pinned catalog',
  add: (agentConversation) =>
    agentConversation.addNodeOfType('KSampler', ADD_POSITION)
}
const FRONTEND_ONLY: AddCase = {
  name: 'a frontend-only node (the footing Get/Set nodes stand on)',
  add: (agentConversation) =>
    agentConversation.addNodeOfType('Note', ADD_POSITION)
}
// The non-Agent baseline (workflowTabSwitchKeepsAddedNodes.spec.ts) adds every
// node through the search box; this case covers that same user-facing path
// while the follower is bound, alongside the direct-API cases above.
const FRONTEND_ONLY_VIA_SEARCH: AddCase = {
  name: 'a frontend-only node added through the node search box',
  add: (agentConversation) =>
    agentConversation.addNoteThroughSearchBox({
      x: ADD_POSITION[0],
      y: ADD_POSITION[1]
    })
}
const BLUEPRINT_PROMOTED: AddCase = {
  name: 'a subgraph blueprint with a promoted widget',
  add: (agentConversation) => agentConversation.addBlueprint(true, ADD_POSITION)
}
const BLUEPRINT_PLAIN: AddCase = {
  name: 'a subgraph blueprint without promoted widgets',
  add: (agentConversation) =>
    agentConversation.addBlueprint(false, ADD_POSITION)
}

// The host took every op it was handed: nothing rejected, and the batch that
// carried the add landed. A blueprint paste can mint more than the one
// add_node (the applier answers `no-op` for an op that changes nothing).
function expectApplied(outcomes: ApplyOutcome[], adds: number): void {
  expect(outcomes.filter((outcome) => outcome.outcome === 'rejected')).toEqual(
    []
  )
  expect(
    outcomes.filter((outcome) => outcome.outcome === 'applied').length
  ).toBeGreaterThanOrEqual(adds)
}

test.describe(
  'Human-added node across a workflow tab switch with Agent bound',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    // Both halves of the mechanism: the host takes the page's add_node op
    // (the host-only contract itself is pinned at the unit level, against the
    // real applier, in mintPortWiring.test.ts), then the tab return whose
    // first frame reconciles the stores against the doc. A node the doc holds
    // survives it.
    for (const { name, add } of [
      CATALOGUED,
      BLUEPRINT_PLAIN,
      FRONTEND_ONLY,
      BLUEPRINT_PROMOTED,
      FRONTEND_ONLY_VIA_SEARCH
    ]) {
      test(`keeps ${name} after switching to another tab and back`, async ({
        agentConversation
      }, testInfo) => {
        test.setTimeout(90_000)

        await test.step('replay the recorded turn', async () => {
          await agentConversation.runTurns()
          await agentConversation.installTabSwitchObserver()
        })

        const nodeId =
          await test.step('add the node and wait for the host to judge it', async () => {
            const addedNodeId = await add(agentConversation)
            const node = agentConversation.vueNodes.getNodeLocator(addedNodeId)
            await expect(node).toBeVisible()
            const outcomes = await agentConversation.waitForHumanOps(1)
            expectApplied(outcomes, 1)
            return addedNodeId
          })

        const before = await test.step('capture before-switch evidence', () =>
          agentConversation.attachEvidence(testInfo, 'before-switch'))

        expect(before.live).toContain(nodeId)
        expect(before.serialized).toContain(nodeId)

        await test.step('switch to another tab and back', () =>
          agentConversation.switchAwayAndBack(PROMPT_NODE_ID, PROMPT_WIDGET))

        await test.step('capture after-return evidence and check the node survived the reconcile', async () => {
          const after = await agentConversation.attachEvidence(
            testInfo,
            'after-return'
          )
          expect(after.activeState).toContain(nodeId)
          expect(after.observer?.afterConfigure.at(-1)).toContain(nodeId)
          await expect(
            agentConversation.vueNodes.getNodeLocator(nodeId)
          ).toBeVisible()
          expect(after.observer?.removed).not.toContain(nodeId)
          expect(after.live).toContain(nodeId)
          expect(after.serialized).toContain(nodeId)
        })
      })
    }

    // The same reconcile without any tab switch: the echo of an accepted add
    // is rejected locally ("already registered") and arms a full reconcile,
    // which the next frame runs against a doc that now holds the Note too.
    test('keeps a frontend-only node when two catalogued nodes are added after it', async ({
      agentConversation
    }, testInfo) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn', async () => {
        await agentConversation.runTurns()
        await agentConversation.installTabSwitchObserver()
      })

      const { noteId, samplerId, encoderId, outcomes } =
        await test.step('add the frontend-only node, then two catalogued nodes', async () => {
          const noteId = await agentConversation.addNodeOfType(
            'Note',
            ADD_POSITION
          )
          const note = agentConversation.vueNodes.getNodeLocator(noteId)
          await expect(note).toBeVisible()
          await agentConversation.waitForHumanOps(1)

          const samplerId = await agentConversation.addNodeOfType(
            'KSampler',
            ADD_POSITION
          )
          await agentConversation.waitForHumanOps(2)
          const encoderId = await agentConversation.addNodeOfType(
            'CLIPTextEncode',
            ADD_POSITION
          )
          const outcomes = await agentConversation.waitForHumanOps(3)
          return { noteId, samplerId, encoderId, outcomes }
        })

      await test.step('reconciliation runs on the next frame; check the node survived it', async () => {
        await agentConversation.waitForPendingFrames(
          PROMPT_NODE_ID,
          PROMPT_WIDGET,
          'op echoes landed'
        )
        const lens = await agentConversation.attachEvidence(
          testInfo,
          'after-adds'
        )
        expectApplied(outcomes, 3)
        expect(agentConversation.hostNodeIds()).toEqual(
          expect.arrayContaining([noteId, samplerId, encoderId])
        )
        await expect(
          agentConversation.vueNodes.getNodeLocator(noteId)
        ).toBeVisible()
        expect(lens.observer?.removed).not.toContain(noteId)
        expect(lens.live).toEqual(
          expect.arrayContaining([noteId, samplerId, encoderId])
        )
      })
    })
  }
)
