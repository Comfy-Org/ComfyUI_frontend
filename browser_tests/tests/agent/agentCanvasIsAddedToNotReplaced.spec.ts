import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import {
  ADDITIVE_CANVAS_CASE,
  ADDITIVE_READINESS_NODE_ID,
  ADDITIVE_READINESS_WIDGET,
  AGENT_BUILD,
  INSERT_WORKFLOW,
  USER_NOTE_POSITION,
  USER_NOTE_TEXT
} from '@e2e/fixtures/data/agent/agentCanvasAdditive'

test.describe(
  'Agent work adds to the canvas instead of replacing it',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: ADDITIVE_CANVAS_CASE, humanOpsHost: 'hold' })

    test('story 37: an inserted workflow leaves the note the user was working on', async ({
      agentConversation,
      comfyPage
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const noteId =
        await test.step('user writes a note of their own', async () => {
          const id = await agentConversation.addNoteThroughSearchBox({
            x: USER_NOTE_POSITION[0],
            y: USER_NOTE_POSITION[1]
          })
          await comfyPage.nextFrame()
          const note = agentConversation.vueNodes.getNodeLocator(id)
          await expect(note).toBeVisible()
          const textbox = note.getByRole('textbox')
          await textbox.fill(USER_NOTE_TEXT)
          await textbox.press('Tab')
          await comfyPage.nextFrame()
          await expect(textbox).toHaveValue(USER_NOTE_TEXT)
          return id
        })

      const nodesBefore = await agentConversation.vueNodes.nodes.count()
      const nodeIdsBefore = new Set(
        await agentConversation.vueNodes.nodes.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('data-node-id'))
        )
      )

      await test.step('agent inserts a workflow', () => {
        agentConversation.pushHostOps([INSERT_WORKFLOW])
      })

      await test.step('let every queued frame land', () =>
        agentConversation.waitForPendingFrames(
          ADDITIVE_READINESS_NODE_ID,
          ADDITIVE_READINESS_WIDGET,
          'insert_workflow frame landed'
        ))

      await comfyPage.nextFrame()

      await test.step("the insert added a node and kept the user's note", async () => {
        await expect(agentConversation.vueNodes.nodes).toHaveCount(
          nodesBefore + 1
        )
        const nodeIdsAfter = await agentConversation.vueNodes.nodes.evaluateAll(
          (nodes) => nodes.map((node) => node.getAttribute('data-node-id'))
        )
        const insertedNodeIds = nodeIdsAfter.filter(
          (nodeId): nodeId is string =>
            nodeId !== null && !nodeIdsBefore.has(nodeId)
        )
        expect(insertedNodeIds).toHaveLength(1)
        const inserted = agentConversation.vueNodes.getNodeLocator(
          insertedNodeIds[0]
        )
        await expect(inserted.getByTestId('node-title')).toContainText(
          'Empty Latent Image'
        )
        await expect(inserted.getByRole('spinbutton').nth(0)).toHaveValue('512')
        await expect(inserted.getByRole('spinbutton').nth(1)).toHaveValue('512')
        const note = agentConversation.vueNodes.getNodeLocator(noteId)
        await expect(note).toBeVisible()
        await expect(note.getByRole('textbox').first()).toHaveValue(
          USER_NOTE_TEXT
        )
      })
    })

    test('story 32: a redelivered build does not leave a second copy', async ({
      agentConversation,
      comfyPage
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const nodesBefore = await agentConversation.vueNodes.nodes.count()

      const buildFrame = await test.step('agent builds two nodes', () =>
        agentConversation.pushHostOps(AGENT_BUILD))

      await test.step('let the build land', () =>
        agentConversation.waitForPendingFrames(
          ADDITIVE_READINESS_NODE_ID,
          ADDITIVE_READINESS_WIDGET,
          'agent build landed'
        ))

      await comfyPage.nextFrame()

      await expect(agentConversation.vueNodes.nodes).toHaveCount(
        nodesBefore + AGENT_BUILD.length
      )
      for (const [index, width] of [512, 768].entries()) {
        const built = agentConversation.vueNodes.getNodeLocator(
          String(990001 + index)
        )
        await expect(built.getByTestId('node-title')).toContainText(
          'Empty Latent Image'
        )
        await expect(built.getByRole('spinbutton').nth(0)).toHaveValue(
          String(width)
        )
        await expect(built.getByRole('spinbutton').nth(1)).toHaveValue('512')
      }

      await test.step('the same build is delivered a second time', () => {
        agentConversation.redeliverHostFrame(buildFrame)
      })

      await test.step('let the redelivery land', () =>
        agentConversation.waitForPendingFrames(
          ADDITIVE_READINESS_NODE_ID,
          ADDITIVE_READINESS_WIDGET,
          'agent build redelivered'
        ))

      await comfyPage.nextFrame()

      await test.step('the canvas holds one copy of the build', async () => {
        await expect(agentConversation.vueNodes.nodes).toHaveCount(
          nodesBefore + AGENT_BUILD.length
        )
      })
    })
  }
)
