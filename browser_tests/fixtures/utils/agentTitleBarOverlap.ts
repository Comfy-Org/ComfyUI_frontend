import type { Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import {
  BLANK_WORKFLOW,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  EXISTING_NODES,
  INCOMING_NODES,
  INSERT_INCOMING_OPS,
  MESSAGE_ID,
  THREAD_ID,
  TITLE_BAR_CATALOG,
  WORKFLOW_ID
} from '@e2e/fixtures/data/agentTitleBarOverlap'
import { subscribeAgentWorkflow } from '@e2e/fixtures/utils/subscribeAgentWorkflow'
import { nextFrame } from '@e2e/fixtures/utils/timing'

function readNodeBoxes(page: Page) {
  return page.evaluate(() => {
    const titleBarHeight = window.LiteGraph!.NODE_TITLE_HEIGHT
    return window.app!.graph.nodes.map((node) => {
      const [bx, by, bw, bh] = node.boundingRect
      return {
        id: String(node.id),
        text: String(node.widgets?.[0]?.value ?? ''),
        titleBarHeight,
        body: {
          x: node.pos[0],
          y: node.pos[1],
          width: node.size[0],
          height: node.size[1]
        },
        rendered: { x: bx, y: by, width: bw, height: bh }
      }
    })
  })
}

type Box = { x: number; y: number; width: number; height: number }
type NodeBox = Awaited<ReturnType<typeof readNodeBoxes>>[number]

function describeUnmeasured(boxes: readonly NodeBox[]) {
  return boxes
    .filter(
      (box) =>
        box.rendered.width <= 0 ||
        box.rendered.height < box.body.height + box.titleBarHeight
    )
    .map(
      (box) =>
        `"${box.text}" has no rendered box including its title bar ` +
        `(${box.rendered.width}x${box.rendered.height})`
    )
}

async function readMeasuredNodeBoxes(page: Page) {
  await nextFrame(page)
  await expect
    .poll(async () => describeUnmeasured(await readNodeBoxes(page)))
    .toEqual([])
  return readNodeBoxes(page)
}

function overlap(a: Box, b: Box): number {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return x > 0 && y > 0 ? Math.round(Math.min(x, y)) : 0
}

function describeOverlaps(
  incoming: readonly NodeBox[],
  existing: readonly NodeBox[],
  which: 'body' | 'rendered'
) {
  return incoming.flatMap((node) =>
    existing
      .filter((other) => overlap(node[which], other[which]) > 0)
      .map(
        (other) =>
          `"${node.text}" overlaps "${other.text}" by ` +
          `${overlap(node[which], other[which])}px`
      )
  )
}

export async function bindTitleBarOverlapTab(
  page: Page,
  getAgentSocket: () => Promise<WebSocketRoute>
) {
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
    prompt: 'Add a node below the one already here'
  })

  const host = new HostDoc(
    WORKFLOW_ID,
    { nodes: EXISTING_NODES, links: [] },
    TITLE_BAR_CATALOG
  )
  for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))
  await expect
    .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
    .toBe(EXISTING_NODES.length)
  const existingIds = (await readMeasuredNodeBoxes(page)).map((box) => box.id)

  return {
    async addNodeBelow() {
      socket.send(JSON.stringify(host.apply(INSERT_INCOMING_OPS)))
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(EXISTING_NODES.length + INCOMING_NODES.length)
    },
    async readPlacement() {
      const boxes = await readMeasuredNodeBoxes(page)
      const existing = boxes.filter((box) => existingIds.includes(box.id))
      const incoming = boxes.filter((box) => !existingIds.includes(box.id))
      return {
        unmeasured: describeUnmeasured(boxes),
        titleBarHeight: boxes[0].titleBarHeight,
        renderedOverlaps: describeOverlaps(incoming, existing, 'rendered'),
        bodyOverlaps: describeOverlaps(incoming, existing, 'body'),
        boxes
      }
    }
  }
}
