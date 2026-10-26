import { expect, mergeTests } from '@playwright/test'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'

import {
  agentTest,
  BLANK_WORKFLOW,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { subscribeAgentWorkflow } from '@e2e/fixtures/utils/subscribeAgentWorkflow'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

const WORKFLOW_ID = 'b3e7d9c1-0000-4000-8000-000000000947'
const MESSAGE_ID = 'b3e7d9c1-0000-4000-8000-000000000948'
const THREAD_ID = 'b3e7d9c1-0000-4000-8000-000000000949'

function note(id: number, pos: [number, number], text: string) {
  return {
    id,
    type: 'MarkdownNote',
    pos,
    size: [320, 200],
    mode: 0,
    order: 0,
    flags: {},
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: [text]
  }
}

const EXISTING_NODES = [note(1, [0, 0], 'Existing node')]

// A two-stage build: each stage is a titled frame around its own nodes.
const TEMPLATE = {
  nodes: [
    note(11, [0, 100], 'Load image'),
    note(12, [380, 100], 'Describe image'),
    note(21, [860, 100], 'Prompt from description'),
    note(22, [1240, 100], 'Generate image')
  ],
  links: [],
  groups: [
    {
      id: 1,
      title: 'Stage 1: describe the input image',
      bounding: [-20, 20, 740, 300],
      color: '#3f789e',
      font_size: 24,
      flags: {}
    },
    {
      id: 2,
      title: 'Stage 2: generate from the description',
      bounding: [840, 20, 740, 300],
      color: '#b58b2a',
      font_size: 24,
      flags: {}
    }
  ]
}

const CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}

const INSERT_OPS = [
  {
    op_id: 'agent-stage-frames-insert-op-0'.padEnd(32, '0'),
    actor: 'agent:e2e:turn-1',
    base_version: 1,
    stamp: [1, 'agent:e2e:turn-1'],
    op: 'insert_workflow',
    workflow: TEMPLATE
  }
] satisfies Op[]

test.describe(
  'Agent stage frames carried by insert_workflow (PM-947)',
  {
    tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'],
    annotation: {
      type: 'issue',
      description:
        'https://linear.app/comfyorg/issue/PM-947/fix-agent-doesnt-create-groupsframes-to-label-the-stages-of-a-complex'
    }
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('shows each titled stage frame around its own nodes, clear of the existing graph', async ({
      page,
      getAgentSocket
    }) => {
      await page.setViewportSize({ width: 1920, height: 1280 })
      await bootAgentApp(page, true, {
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
      await subscribeAgentWorkflow({
        agentPanel,
        socket,
        workflowId: WORKFLOW_ID,
        prompt: 'Build a describe-then-generate workflow with labelled stages'
      })

      const host = new HostDoc(
        WORKFLOW_ID,
        { nodes: EXISTING_NODES, links: [] },
        CATALOG
      )
      for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(EXISTING_NODES.length)

      socket.send(JSON.stringify(host.apply(INSERT_OPS)))
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(EXISTING_NODES.length + TEMPLATE.nodes.length)

      const readFrames = () =>
        page.evaluate(() => {
          const graph = window.app!.graph
          const text = (node: (typeof graph.nodes)[number]) =>
            String(node.widgets?.[0]?.value ?? '')
          return graph.groups
            .map((group) => {
              group.recomputeInsideNodes()
              return {
                title: group.title,
                members: group.nodes.map(text).sort()
              }
            })
            .sort((a, b) => a.title.localeCompare(b.title))
        })

      await expect.poll(readFrames).toEqual([
        {
          title: 'Stage 1: describe the input image',
          members: ['Describe image', 'Load image']
        },
        {
          title: 'Stage 2: generate from the description',
          members: ['Generate image', 'Prompt from description']
        }
      ])

      // The frames travel with the placed batch and persist in the saved
      // workflow with the same geometry the canvas shows.
      const persisted = await page.evaluate(() => {
        const graph = window.app!.graph
        const existing = graph.nodes.find(
          (node) => node.widgets?.[0]?.value === 'Existing node'
        )!
        const [ex, ey, ew, eh] = existing.boundingRect
        return {
          live: Object.fromEntries(
            graph.groups.map((group) => [group.title, [...group._bounding]])
          ),
          saved: Object.fromEntries(
            graph
              .serialize()
              .groups.map((group) => [group.title, [...group.bounding]])
          ),
          overlapsExisting: graph.groups
            .filter((group) => {
              const [gx, gy, gw, gh] = group._bounding
              return (
                gx < ex + ew && ex < gx + gw && gy < ey + eh && ey < gy + gh
              )
            })
            .map((group) => group.title)
        }
      })
      expect(persisted.saved).toEqual(persisted.live)
      expect(persisted.overlapsExisting).toEqual([])
    })
  }
)
