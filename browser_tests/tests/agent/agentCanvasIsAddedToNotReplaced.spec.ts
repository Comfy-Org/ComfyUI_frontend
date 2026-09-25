import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

// Two stories of qa/user-story-test-matrix.md (in-app-agent-program). Both
// are the canvas losing its identity to the agent's own work:
//
//   32 "The agent builds a second complete copy on top of my existing work"
//      -- regr-14 (PM-1403, PM-1404, PR 18175), slack-68. No pin; the only
//      pins regr-14 names were unit tests #18700 deletes.
//   37 "Loading a template wipes the canvas I was working on"
//      -- slack-23, slack-32. Pin 18702. Also reached without a template:
//      a question or a small edit empties the graph.
//
// Both are frozen-area, so this is black-box: it drives the real follower and
// judges the rendered canvas. agentInsertWorkflowCanvasResult.spec.ts already
// covers what an `insert_workflow` op *produces*, but it inserts onto an empty
// document, so what the insert does to content that was already there is
// unpinned. agentTemplatePlacement.spec.ts asserts where the inserted nodes
// land, not that the existing node is still on the canvas afterwards.

const CASE = 'agent-rec-text-only-answer'

// The seed's "Positive prompt" CLIPTextEncode; a host edit to its text is the
// readiness boundary for "every frame queued ahead of this one has landed".
const PROMPT_NODE_ID = '6'
const PROMPT_WIDGET = 'text'

const USER_NODE_POSITION: [number, number] = [1500, 700]
const USER_NOTE_TEXT = 'do not lose me'

const INSERTED_NODE_ID = 880001
const INSERT_WORKFLOW: RecordedGraphOperation = {
  op: 'insert_workflow',
  workflow: {
    nodes: [
      {
        id: INSERTED_NODE_ID,
        type: 'EmptyLatentImage',
        pos: [1900, 200],
        size: [270, 106],
        mode: 0,
        flags: {},
        order: 0,
        inputs: [],
        outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
        properties: {},
        widgets_values: [512, 512, 1]
      }
    ],
    links: []
  }
}

const AGENT_BUILD: RecordedGraphOperation[] = [512, 768].map(
  (width, index) => ({
    op: 'add_node',
    node_id: 990001 + index,
    class_type: 'EmptyLatentImage',
    pos: [2200 + index * 320, 200],
    node: {
      id: 990001 + index,
      type: 'EmptyLatentImage',
      pos: [2200 + index * 320, 200],
      size: [270, 106],
      mode: 0,
      flags: {},
      order: 0,
      inputs: [],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
      properties: {},
      widgets_values: [width, 512, 1]
    }
  })
)

test.describe(
  'Agent work adds to the canvas instead of replacing it',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('story 37: an inserted workflow leaves the note the user was working on', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const noteId =
        await test.step('user writes a note of their own', async () => {
          const id = await agentConversation.addNodeOfType(
            'Note',
            USER_NODE_POSITION
          )
          await page.evaluate(
            ([nodeId, text]) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === nodeId
              )
              if (!node) throw new Error(`node ${nodeId} is not on the graph`)
              const widget = node.widgets?.[0]
              if (!widget) throw new Error(`node ${nodeId} has no text widget`)
              widget.value = text
            },
            [id, USER_NOTE_TEXT] as const
          )
          await expect(
            agentConversation.vueNodes.getNodeLocator(id)
          ).toBeVisible()
          return id
        })

      const nodesBefore = await agentConversation.vueNodes.nodes.count()

      await test.step('agent inserts a workflow', () => {
        agentConversation.pushHostOps([INSERT_WORKFLOW])
      })

      await test.step('let every queued frame land', () =>
        agentConversation.waitForPendingFrames(
          PROMPT_NODE_ID,
          PROMPT_WIDGET,
          'insert_workflow frame landed'
        ))

      await test.step("the insert added a node and kept the user's note", async () => {
        await expect(agentConversation.vueNodes.nodes).toHaveCount(
          nodesBefore + 1
        )
        const note = agentConversation.vueNodes.getNodeLocator(noteId)
        await expect(note).toBeVisible()
        await expect(note.getByRole('textbox').first()).toHaveValue(
          USER_NOTE_TEXT
        )
      })
    })

    test('story 32: a redelivered build does not leave a second copy', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const nodesBefore = await agentConversation.vueNodes.nodes.count()

      await test.step('agent builds two nodes', () => {
        agentConversation.pushHostOps(AGENT_BUILD)
      })

      await test.step('let the build land', () =>
        agentConversation.waitForPendingFrames(
          PROMPT_NODE_ID,
          PROMPT_WIDGET,
          'agent build landed'
        ))

      await expect(agentConversation.vueNodes.nodes).toHaveCount(
        nodesBefore + AGENT_BUILD.length
      )

      // The same batch again, the way a retried or re-echoed delivery arrives.
      // A build that is applied twice must leave one copy, not two.
      await test.step('the same build is delivered a second time', () => {
        agentConversation.pushHostOps(AGENT_BUILD)
      })

      await test.step('let the redelivery land', () =>
        agentConversation.waitForPendingFrames(
          PROMPT_NODE_ID,
          PROMPT_WIDGET,
          'agent build redelivered'
        ))

      await test.step('the canvas holds one copy of the build', async () => {
        await expect(agentConversation.vueNodes.nodes).toHaveCount(
          nodesBefore + AGENT_BUILD.length
        )
      })
    })
  }
)
