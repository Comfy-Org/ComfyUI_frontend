import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

const TEMPLATE = 'pm-1733-app-template'
const TEMPLATE_WORKFLOW = 'browser_tests/assets/linear-basic-app-template.json'
const OFFSCREEN_CAMERA = { offset: -60000, scale: 0.05 }

/**
 * PM-1732 / PM-1733 — App Mode keeps the graph canvas mounted but hidden, so
 * its element measures 0x0. Loading a template from there used to fit the view
 * against that zero-size element, leaving the camera at scale 0 with NaN
 * offsets, and returning to the graph showed a blank canvas with every node
 * still in it.
 */
test.describe('App mode template load', { tag: ['@canvas'] }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('keeps the graph framed on the nodes when returning from app mode', async ({
    comfyPage,
    templateApi
  }) => {
    const page = comfyPage.page

    function canvasWidth() {
      return page.evaluate(() => window.app!.canvasEl.width)
    }

    function activeWorkflowName() {
      return page.evaluate(
        () =>
          window.app!.extensionManager.workflow.activeWorkflow?.filename ?? ''
      )
    }

    function viewMode() {
      return page.evaluate(() => {
        const workflow = window.app!.extensionManager.workflow.activeWorkflow
        return workflow?.activeMode ?? workflow?.initialMode ?? 'graph'
      })
    }

    function framing() {
      return page.evaluate(() => {
        const app = window.app!
        const { ds } = app.canvas
        const [vx, vy, vw, vh] = ds.visible_area
        const nodesInView = app.rootGraph.nodes.filter((node) => {
          const [x, y, w, h] = node.boundingRect
          return x < vx + vw && vx < x + w && y < vy + vh && vy < y + h
        }).length
        return {
          scale: ds.scale,
          offset: [...ds.offset],
          nodeCount: app.rootGraph.nodes.length,
          nodesInView
        }
      })
    }

    templateApi.configure(
      withTemplates([makeTemplate({ name: TEMPLATE, title: 'App Template' })])
    )
    await templateApi.mock()
    await templateApi.mockWorkflow(TEMPLATE, TEMPLATE_WORKFLOW)

    await test.step('app mode hides the canvas', async () => {
      await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])
      await expect(comfyPage.appMode.centerPanel).toBeVisible()
      await expect.poll(canvasWidth).toBe(0)
    })

    await test.step('the camera starts off the nodes', async () => {
      // Without the deferred fit this is the camera the user returns to, so
      // parking it here is what makes the final assertion discriminating.
      await page.evaluate((camera) => {
        const { ds } = window.app!.canvas
        ds.offset[0] = camera.offset
        ds.offset[1] = camera.offset
        ds.scale = camera.scale
      }, OFFSCREEN_CAMERA)
    })

    await test.step('the template loads while the canvas is hidden', async () => {
      await templateApi.load(TEMPLATE)
      await expect.poll(activeWorkflowName).toContain(TEMPLATE)
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect.poll(viewMode).toBe('app')
      await expect.poll(canvasWidth).toBe(0)
    })

    await test.step('returning to the graph frames the template', async () => {
      await comfyPage.appMode.toggleAppMode()
      await expect.poll(viewMode).toBe('graph')
      await expect.poll(canvasWidth).toBeGreaterThan(0)
      await expect
        .poll(async () => (await framing()).nodesInView)
        .toBeGreaterThan(0)

      const { scale, offset, nodeCount } = await framing()
      expect(nodeCount).toBeGreaterThan(0)
      expect(scale).toBeGreaterThan(0)
      expect(
        offset.every(Number.isFinite),
        `camera offset stays finite, got ${JSON.stringify(offset)}`
      ).toBe(true)
    })
  })
})
