import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// Minimal node used only to prove the clipboard leak; the bug is not
// specific to any node type.
const COMPOSER_PASTE_NODE_DEF: ComfyNodeDef = {
  name: 'ComposerPasteTestNode',
  display_name: 'Composer paste test node',
  description:
    'Reproduces the agent composer paste bug: pasting text into the agent composer.',
  category: 'utils',
  python_module: 'tests.composer_paste_test_node',
  output_node: false,
  input: { required: {} },
  output: []
}

const SINGLE_NODE_WORKFLOW: ComfyWorkflowJSON = {
  last_node_id: 1,
  last_link_id: 0,
  version: 0.4,
  nodes: [
    {
      id: 1,
      type: 'ComposerPasteTestNode',
      pos: [400, 250],
      size: [240, 80],
      flags: {},
      order: 0,
      mode: 0,
      properties: {}
    }
  ],
  links: []
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test(
  'pasting plain text into the agent composer does not also paste the last copied node',
  { tag: ['@cloud', '@agent'] },
  async ({ page }) => {
    await page.route('**/api/object_info', (route) =>
      route.fulfill(
        jsonRoute({ ComposerPasteTestNode: COMPOSER_PASTE_NODE_DEF })
      )
    )
    await bootAgentApp(page, true, { objectInfo: 'server' })

    // Load a single node onto the canvas before opening the agent panel, so
    // there is no "discard unsaved changes?" prompt to dismiss.
    await page.locator('#comfy-file-input').setInputFiles({
      name: 'composer-paste-repro.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(SINGLE_NODE_WORKFLOW))
    })

    const getNodeCount = () =>
      page.evaluate(() => window.app!.graph.nodes.length)
    await expect.poll(getNodeCount).toBe(1)

    // Copy the node with the real canvas shortcut, the same as a user would.
    await page.evaluate(() => {
      const [node] = window.app!.graph.nodes
      window.app!.canvas.centerOnNode(node)
    })
    const canvas = page.locator('#graph-canvas')
    await canvas.click()
    await canvas.press('Control+c')

    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    await composer.click()

    const pastedText = 'a plain text prompt, not a node'
    await page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      pastedText
    )
    await composer.press('ControlOrMeta+v')

    // The text itself lands correctly - this part of the bug report is not
    // in dispute.
    await expect(composer).toHaveText(pastedText)

    await page.screenshot({
      path: 'test-results/agent-composer-paste-repro.png'
    })

    await expect(getNodeCount()).resolves.toBe(1)
  }
)
