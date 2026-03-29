/**
 * Seed test for Playwright AI agents.
 *
 * This test bootstraps the ComfyUI environment for agent exploration.
 * When agents (Planner, Generator, Healer) run, they execute this test
 * first to set up the browser state, then use it as a template for
 * generated tests.
 *
 * Usage:
 *   - Planner: Runs this to explore the app, then generates a test plan
 *   - Generator: Uses this as an import/fixture template
 *   - Healer: Runs this to establish baseline state
 */
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test('seed', async ({ comfyPage }) => {
  // Load the default workflow — gives agents a realistic starting state
  await comfyPage.workflow.loadWorkflow('default')
  await comfyPage.nextFrame()

  // Verify the app is ready
  await expect(comfyPage.canvas).toBeVisible()
})
