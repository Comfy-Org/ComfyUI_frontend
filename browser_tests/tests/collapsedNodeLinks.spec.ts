import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

const SLOT_BOUNDS_MARGIN = 20

async function waitForNodeLayout(page: Page, nodeId: string) {
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector(`[data-node-id="${id}"]`)
      if (!el) return false
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    },
    nodeId,
    { timeout: 5000 }
  )
}

async function loadWithPositions(
  page: Page,
  positions: Record<string, [number, number]>
) {
  await page.evaluate(
    async ({ positions }) => {
      const data = window.app!.graph.serialize()
      for (const node of data.nodes) {
        const pos = positions[String(node.id)]
        if (pos) node.pos = pos
      }
      await window.app!.loadGraphData(
        data as ComfyWorkflowJSON,
        true,
        true,
        null
      )
    },
    { positions }
  )
}

async function setNodeCollapsed(
  page: Page,
  nodeId: string,
  collapsed: boolean
) {
  await page.evaluate(
    ({ id, collapsed }) => {
      const node = window.app!.graph._nodes.find(
        (n: { id: number | string }) => String(n.id) === id
      )
      if (node) {
        node.flags = node.flags || {}
        node.flags.collapsed = collapsed
        window.app!.canvas.setDirty(true, true)
      }
    },
    { id: nodeId, collapsed }
  )
  await waitForNodeLayout(page, nodeId)
}

async function assertSlotsWithinNodeBounds(page: Page, nodeId: string) {
  await page
    .locator(`[data-node-id="${nodeId}"] [data-slot-key]`)
    .first()
    .waitFor()

  const result = await page.evaluate(
    ({ nodeId, margin }) => {
      const nodeEl = document.querySelector(
        `[data-node-id="${nodeId}"]`
      ) as HTMLElement | null
      if (!nodeEl) return { ok: false, violations: ['node element not found'] }

      const nodeRect = nodeEl.getBoundingClientRect()
      const slotEls = nodeEl.querySelectorAll('[data-slot-key]')
      const violations: string[] = []

      for (const slotEl of slotEls) {
        const slotRect = slotEl.getBoundingClientRect()
        const cx = slotRect.left + slotRect.width / 2 - nodeRect.left
        const cy = slotRect.top + slotRect.height / 2 - nodeRect.top

        if (cx < -margin || cx > nodeRect.width + margin)
          violations.push(`slot X=${cx} outside width=${nodeRect.width}`)
        if (cy < -margin || cy > nodeRect.height + margin)
          violations.push(`slot Y=${cy} outside height=${nodeRect.height}`)
      }

      return { ok: violations.length === 0, violations }
    },
    { nodeId, margin: SLOT_BOUNDS_MARGIN }
  )

  expect(
    result.ok,
    `Slot positions out of bounds: ${result.violations?.join(', ')}`
  ).toBe(true)
}

const SUBGRAPH_ID = '2'
const WORKFLOW = 'selection/subgraph-with-regular-node'

test.describe(
  'Collapsed node link positions',
  { tag: ['@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('link endpoints stay within collapsed node bounds', async ({
      comfyPage
    }) => {
      await setNodeCollapsed(comfyPage.page, SUBGRAPH_ID, true)
      await assertSlotsWithinNodeBounds(comfyPage.page, SUBGRAPH_ID)
    })

    test('links follow collapsed node after position change', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await loadWithPositions(page, { [SUBGRAPH_ID]: [200, 200] })
      await comfyPage.vueNodes.waitForNodes()
      await setNodeCollapsed(page, SUBGRAPH_ID, true)
      await assertSlotsWithinNodeBounds(page, SUBGRAPH_ID)
    })

    test('links recover correct positions after expand', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await setNodeCollapsed(page, SUBGRAPH_ID, true)
      await waitForNodeLayout(page, SUBGRAPH_ID)
      await setNodeCollapsed(page, SUBGRAPH_ID, false)
      await waitForNodeLayout(page, SUBGRAPH_ID)
      await assertSlotsWithinNodeBounds(page, SUBGRAPH_ID)
    })
  }
)
