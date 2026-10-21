import { expect, mergeTests } from '@playwright/test'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'

import {
  BLANK_WORKFLOW,
  agentTest,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

// PM-2232 (https://linear.app/comfyorg/issue/PM-2232): asking the agent to
// insert the Z-Image template into a tab that already had nodes left the
// template on top of the existing graph. get_template mints one
// insert_workflow op carrying the template's baked-in coordinates, and the
// follower only moved a batch that landed far away and offscreen (PM-1142),
// so a batch landing on the user's nodes kept its overlapping position.

const WORKFLOW_ID = 'b3e7d9c1-0000-4000-8000-000000000020'
const MESSAGE_ID = 'b3e7d9c1-0000-4000-8000-000000000021'
const THREAD_ID = 'b3e7d9c1-0000-4000-8000-000000000022'

type Rect = { x: number; y: number; width: number; height: number }

function note(
  id: number,
  pos: [number, number],
  size: [number, number],
  text: string
) {
  return {
    id,
    type: 'MarkdownNote',
    pos,
    size,
    mode: 0,
    order: 0,
    flags: {},
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: [text]
  }
}

// The user's graph, occupying the same region as the default workflow.
const EXISTING_NODES = [
  note(1, [0, 180], [400, 300], 'Existing node A'),
  note(2, [450, 180], [400, 300], 'Existing node B'),
  note(3, [900, 180], [400, 300], 'Existing node C')
]

// The baked-in node rects of templates/image_z_image_turbo.json in
// Comfy-Org/workflow_templates: a MarkdownNote, the Z-Image subgraph
// instance, and SaveImage.
const TEMPLATE_NODES = [
  note(35, [-420, 200], [510, 772], 'Template note'),
  note(57, [130, 200], [400, 470], 'Template sampler'),
  note(9, [570, 200], [780, 660], 'Template save')
]

const catalog: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}

function insertTemplateOps() {
  return [
    {
      op_id: 'agent-insert-workflow-overlap-op-0'.padEnd(32, '0'),
      actor: 'agent:e2e',
      base_version: 1,
      stamp: [1, 'agent:e2e'],
      op: 'insert_workflow',
      workflow: { nodes: TEMPLATE_NODES, links: [] }
    }
  ] satisfies Op[]
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

test.describe(
  'Agent insert_workflow into a populated tab',
  { tag: ['@cloud', '@agent', '@canvas'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('places an inserted template clear of the nodes already on the canvas', async ({
      page,
      getAgentSocket
    }, testInfo) => {
      test.setTimeout(60_000)
      await page.setViewportSize({ width: 1920, height: 1280 })
      await bootAgentApp(page, true, {
        settings: { 'Comfy.VueNodes.Enabled': true },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            message_id: MESSAGE_ID,
            thread_id: THREAD_ID,
            workflow_id: WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })
      await loadIntoBootWorkflow(page, BLANK_WORKFLOW)

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const socket = await getAgentSocket()
      const outboundFrames: string[] = []
      socket.onMessage((message) => outboundFrames.push(String(message)))
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Insert the Z-Image template into this tab')

      await expect
        .poll(() => outboundFrames, { timeout: 15_000 })
        .toContainEqual(
          expect.stringMatching(
            new RegExp(
              `doc_subscribe.*${WORKFLOW_ID}|${WORKFLOW_ID}.*doc_subscribe`
            )
          )
        )

      const host = new HostDoc(
        WORKFLOW_ID,
        { nodes: EXISTING_NODES, links: [] },
        catalog
      )
      for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))

      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(EXISTING_NODES.length)
      const existingIds = await page.evaluate(() =>
        window.app!.graph.nodes.map((node) => String(node.id))
      )

      // The get_template tool call commits as one insert_workflow op.
      socket.send(JSON.stringify(host.apply(insertTemplateOps())))

      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(EXISTING_NODES.length + TEMPLATE_NODES.length)

      const rects = await page.evaluate(() =>
        window.app!.graph.nodes.map((node) => ({
          id: String(node.id),
          text: String(node.widgets?.[0]?.value ?? ''),
          x: node.pos[0],
          y: node.pos[1],
          width: node.size[0],
          height: node.size[1]
        }))
      )
      const existing = rects.filter((rect) => existingIds.includes(rect.id))
      const inserted = rects.filter((rect) => !existingIds.includes(rect.id))

      // Frame every node left of the Agent panel for the attached screenshot.
      await page.evaluate(() => {
        const canvas = window.app!.canvas
        const nodes = window.app!.graph.nodes
        canvas.ds.scale = 0.4
        canvas.ds.offset = [
          120 / canvas.ds.scale - Math.min(...nodes.map((node) => node.pos[0])),
          200 / canvas.ds.scale - Math.min(...nodes.map((node) => node.pos[1]))
        ]
        canvas.setDirty(true, true)
      })
      await nextFrame(page)
      await testInfo.attach('insert-into-populated-tab.png', {
        body: await page.screenshot(),
        contentType: 'image/png'
      })

      for (const node of inserted) {
        for (const other of existing) {
          expect(
            overlaps(node, other),
            `inserted "${node.text}" at (${node.x}, ${node.y}) overlaps ` +
              `existing "${other.text}" at (${other.x}, ${other.y})`
          ).toBe(false)
        }
      }

      // The template moves as one unit: its internal layout is unchanged.
      const insertedPos = (text: string) => {
        const node = inserted.find((rect) => rect.text === text)!
        return [node.x, node.y]
      }
      const [noteX, noteY] = insertedPos('Template note')
      for (const template of TEMPLATE_NODES) {
        const [x, y] = insertedPos(template.widgets_values[0])
        expect([x - noteX, y - noteY]).toEqual([
          template.pos[0] - TEMPLATE_NODES[0].pos[0],
          template.pos[1] - TEMPLATE_NODES[0].pos[1]
        ])
      }
    })
  }
)
