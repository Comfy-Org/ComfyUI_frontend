import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// What the user sees when this contract breaks, from the corpus behind
// qa/user-story-test-matrix.md (in-app-agent-program), ranks 34, 48 and 49:
//
//   34 "Agent reads a canvas full of nodes as empty and refuses the work"
//      -- slack-5, attachment F0BV8L0TA6M (GM-12, GM-87..89, GM-103)
//   48 "Groups and frames are invisible to the agent" -- slack-40,
//      attachment F0BV8L0TA6M (GM-45, GM-81); the agent states there are
//      none, and leaves them behind when clearing
//   49 "Agent cannot mute, and reads a bypassed node as active" -- slack-42,
//      https://comfy-organization.slack.com/archives/C0BGH348Z0C/p1785367539511479
//
// All three are one defect at one boundary: the turn the panel posts carries
// a `draft` snapshot of the target workflow, and that snapshot is the agent's
// only picture of the canvas for its first read. When something a user can
// plainly see is missing from it, the agent answers about a graph that is not
// the one on screen -- and no amount of model quality recovers it.
//
// This asserts the snapshot against user actions only: nodes the user added
// through the ordinary add path, a group the user made with Ctrl+G, and modes
// the user set with Ctrl+M / Ctrl+B. It does not assert any frame shape, any
// store, or anything about the projection -- the draft is the product's own
// serialized workflow, so this survives FE #18700.

// A text-only turn: the agent changes nothing, so every node in the draft is
// one the user can point at on screen.
const CASE = 'agent-rec-text-only-answer'
const ADD_POSITION: [number, number] = [900, 200]

// The draft's content is typed as an opaque workflow document at the API
// boundary; this names only the two fields these stories are about.
const zDraftContent = z
  .object({
    nodes: z.array(
      z
        .object({
          id: z.union([z.string(), z.number()]),
          mode: z.number().optional()
        })
        .passthrough()
    ),
    groups: z.array(z.unknown()).optional()
  })
  .passthrough()

const MODE_ALWAYS = 0
const MODE_MUTED = 2
const MODE_BYPASSED = 4

// The seed's "Positive prompt" CLIPTextEncode, present in both the recorded
// document and the tab the harness binds.
const MUTE_TARGET_ID = '6'
// LGraphNode.vue draws a muted or bypassed node at half the global opacity.
const MUTED_OPACITY = '0.5'

test.describe(
  'The draft an Agent turn posts matches the canvas the user is looking at',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE })

    test('carries the nodes, the group and the node modes the user can see', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)

      // Records the body of every turn the panel posts, then hands the
      // request back to the conversation harness, which acks it. Registered
      // from the test body so it resolves ahead of the harness's own route.
      const posted: AgentPostMessageRequest[] = []
      await page.route('**/api/agent/threads/*/messages', (route: Route) => {
        const request = route.request()
        if (request.method() === 'POST')
          posted.push(zAgentPostMessageRequest.parse(request.postDataJSON()))
        return route.fallback()
      })

      const addedId =
        await test.step('user adds a node of their own', async () => {
          const id = await agentConversation.addNodeOfType(
            'KSampler',
            ADD_POSITION
          )
          await expect(
            agentConversation.vueNodes.getNodeLocator(id)
          ).toBeVisible()
          return id
        })

      await test.step('user groups it with Ctrl+G', async () => {
        await agentConversation.vueNodes.selectNode(addedId)
        await expect(agentConversation.vueNodes.selectedNodes).toHaveCount(1)
        await page.keyboard.press('Control+g')
        await expect
          .poll(() =>
            page.evaluate(() => window.app!.graph.serialize().groups.length)
          )
          .toBe(1)
      })

      await test.step('user mutes one seed node and bypasses another', async () => {
        await agentConversation.vueNodes.selectNode('6')
        await page.keyboard.press('Control+m')
        await agentConversation.vueNodes.selectNode('8')
        await page.keyboard.press('Control+b')
        await expect
          .poll(() =>
            page.evaluate(() => {
              const modeOf = (id: string) =>
                window.app!.graph.nodes.find((node) => String(node.id) === id)
                  ?.mode
              return { muted: modeOf('6'), bypassed: modeOf('8') }
            })
          )
          .toEqual({ muted: MODE_MUTED, bypassed: MODE_BYPASSED })
      })

      // Read straight off the rendered canvas: what the user can point at.
      const onScreenNodeIds =
        await agentConversation.vueNodes.nodes.evaluateAll((nodes) =>
          nodes
            .map((node) => node.getAttribute('data-node-id') ?? '')
            .toSorted()
        )
      expect(onScreenNodeIds).toContain(addedId)

      await test.step('user sends a prompt', async () => {
        await agentConversation.sendPrompt(0)
        await expect.poll(() => posted.length).toBe(1)
      })

      const draft = await test.step('the turn carried a draft at all', () => {
        const content = posted[0].draft?.content
        expect(
          content,
          'the posted turn carried no draft snapshot'
        ).toBeTruthy()
        return zDraftContent.parse(content)
      })

      await test.step('story 34: every node the user can see is in the draft', () => {
        const ids = draft.nodes.map((node) => String(node.id)).toSorted()
        expect(ids).toEqual(onScreenNodeIds)
      })

      await test.step('story 48: the group the user made is in the draft', () => {
        expect(draft.groups ?? []).toHaveLength(1)
      })

      await test.step('story 49: the muted and bypassed nodes are not reported as active', () => {
        const modeOf = (id: string) =>
          draft.nodes.find((node) => String(node.id) === id)?.mode
        expect(modeOf('6')).toBe(MODE_MUTED)
        expect(modeOf('8')).toBe(MODE_BYPASSED)
        expect(modeOf(addedId)).toBe(MODE_ALWAYS)
      })
    })

    // The other half of story 49. `set_node_field` carries `mode` in the
    // frozen op vocabulary (WRITABLE_NODE_FIELDS in @comfyorg/comfy-multi-player),
    // so "the agent cannot mute" is not a vocabulary gap; if it reproduces, it
    // reproduces here, where the op reaches the canvas.
    test('mutes a node when the agent sets its mode, and the user can see it', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const target = agentConversation.vueNodes.getNodeLocator(MUTE_TARGET_ID)
      await expect(target).toBeVisible()
      await expect(target).not.toHaveCSS('opacity', MUTED_OPACITY)

      await test.step('agent mutes the node', () => {
        agentConversation.pushHostOps([
          {
            op: 'set_node_field',
            node_id: Number(MUTE_TARGET_ID),
            field: 'mode',
            value: MODE_MUTED
          }
        ])
      })

      await test.step('the node is drawn muted', async () => {
        await expect(target).toHaveCSS('opacity', MUTED_OPACITY)
      })
    })
  }
)
