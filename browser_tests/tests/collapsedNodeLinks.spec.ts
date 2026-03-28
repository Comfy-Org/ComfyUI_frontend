import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

const SLOT_BOUNDS_MARGIN = 20
const SUBGRAPH_ID = '2'
const WORKFLOW = 'selection/subgraph-with-regular-node'

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
      const node = await comfyPage.vueNodes.getFixtureByTitle('Test Subgraph')
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await assertSlotsWithinNodeBounds(comfyPage.page, SUBGRAPH_ID)
    })

    test('links follow collapsed node after drag', async ({ comfyPage }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('Test Subgraph')
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      const box = await node.boundingBox()
      expect(box).not.toBeNull()
      await comfyPage.page.mouse.move(
        box!.x + box!.width / 2,
        box!.y + box!.height / 2
      )
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        box!.x + box!.width / 2 + 200,
        box!.y + box!.height / 2 + 100,
        { steps: 10 }
      )
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await assertSlotsWithinNodeBounds(comfyPage.page, SUBGRAPH_ID)
    })

    test('links recover correct positions after expand', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('Test Subgraph')
      await node.toggleCollapse()
      await comfyPage.nextFrame()
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await assertSlotsWithinNodeBounds(comfyPage.page, SUBGRAPH_ID)
    })
  }
)
