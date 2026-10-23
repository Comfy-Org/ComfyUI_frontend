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
  INSERT_TEMPLATE_OPS,
  MESSAGE_ID,
  OVERLAP_CATALOG,
  THREAD_ID,
  WORKFLOW_ID,
  Z_IMAGE_TEMPLATE_NODES
} from '@e2e/fixtures/data/agentInsertWorkflowOverlap'
import { subscribeAgentWorkflow } from '@e2e/fixtures/utils/subscribeAgentWorkflow'

function readNodeRects(page: Page) {
  return page.evaluate(() =>
    window.app!.graph.nodes.map((node) => ({
      id: String(node.id),
      text: String(node.widgets?.[0]?.value ?? ''),
      x: node.pos[0],
      y: node.pos[1],
      width: node.size[0],
      height: node.size[1]
    }))
  )
}

type NodeRect = Awaited<ReturnType<typeof readNodeRects>>[number]

function overlaps(a: NodeRect, b: NodeRect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

export async function bindPopulatedTab(
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
    prompt: 'Insert the Z-Image template into this tab'
  })

  const host = new HostDoc(
    WORKFLOW_ID,
    { nodes: EXISTING_NODES, links: [] },
    OVERLAP_CATALOG
  )
  for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))
  await expect
    .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
    .toBe(EXISTING_NODES.length)
  const existingIds = (await readNodeRects(page)).map((rect) => rect.id)

  return {
    async insertTemplate() {
      socket.send(JSON.stringify(host.apply(INSERT_TEMPLATE_OPS)))
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(EXISTING_NODES.length + Z_IMAGE_TEMPLATE_NODES.length)
    },
    async readPlacement() {
      const rects = await readNodeRects(page)
      const existing = rects.filter((rect) => existingIds.includes(rect.id))
      const inserted = rects.filter((rect) => !existingIds.includes(rect.id))
      const anchor = inserted.find((rect) => rect.text === 'Template note')
      return {
        overlaps: inserted.flatMap((node) =>
          existing
            .filter((other) => overlaps(node, other))
            .map(
              (other) =>
                `inserted "${node.text}" at (${node.x}, ${node.y}) overlaps ` +
                `existing "${other.text}" at (${other.x}, ${other.y})`
            )
        ),
        layoutFromNote: Object.fromEntries(
          inserted.map((node) => [
            node.text,
            anchor ? [node.x - anchor.x, node.y - anchor.y] : null
          ])
        )
      }
    }
  }
}
