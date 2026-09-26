import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi
} from '@e2e/fixtures/agentPanelFixture'
import { AgentSharedHostFixture } from '@e2e/fixtures/agentSharedHostFixture'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

const WORKFLOW_ID = '16e93c08-e115-478d-aace-0df97ff3ab87'
const THREAD_ID = 'ab4bc091-c995-4f39-8cad-9f90805e76bd'
const MESSAGE_ID = '98e6663f-c9df-4a85-89c4-46ab2a77d174'
const NODE_ID = 720

test.describe(
  'Agent shared document across browser contexts',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('shows the same host edit in two independently connected pages', async ({
      browser
    }) => {
      test.setTimeout(60_000)
      // The runner tears down its own `context` fixture, but not contexts a
      // test opens itself. Closing in `finally` keeps a failed assertion from
      // leaking both of them to worker teardown, where per-context artifacts
      // (video, traces) are not flushed cleanly.
      const contextA = await browser.newContext()
      const contextB = await browser.newContext()
      try {
        const pageA = await contextA.newPage()
        const pageB = await contextB.newPage()
        const sharedHost = new AgentSharedHostFixture(
          WORKFLOW_ID,
          { nodes: [], links: [] },
          { types: { MarkdownNote: { widget_order: ['text'] } } }
        )

        await sharedHost.attach(pageA, 'shared-host-page-a')
        await sharedHost.attach(pageB, 'shared-host-page-b')
        for (const page of [pageA, pageB]) {
          await mockAgentTurnApi(page, {
            thread_id: THREAD_ID,
            message_id: MESSAGE_ID,
            workflow_id: WORKFLOW_ID
          })
          await bootAgentApp(page, true, {
            objectInfo: 'server',
            settings: {
              'Comfy.VueNodes.Enabled': true,
              'Comfy.Graph.CanvasInfo': false
            }
          })
          await page
            .getByRole('button', {
              name: enMessages.agent.entryButton,
              exact: true
            })
            .click()
          const panel = page.locator('#agent-panel-root')
          await panel
            .getByRole('textbox', { name: /Describe ideas/ })
            .fill('Open this workflow')
          await panel.getByRole('button', { name: 'Send' }).click()
          await expect(
            panel.getByText('Open this workflow').first()
          ).toBeVisible()
        }

        sharedHost.broadcast({
          type: 'agent_active_tab',
          data: {
            workflow_id: WORKFLOW_ID,
            name: 'Shared workflow',
            thread_id: THREAD_ID,
            message_id: MESSAGE_ID
          }
        })
        await sharedHost.waitForSubscribers()
        sharedHost.pushAgentOps([
          {
            op: 'add_node',
            node_id: NODE_ID,
            class_type: 'MarkdownNote',
            pos: [0, 0],
            node: {
              id: NODE_ID,
              type: 'MarkdownNote',
              pos: [0, 0],
              size: [220, 100],
              mode: 0,
              flags: {},
              order: 0,
              inputs: [],
              outputs: [],
              properties: {},
              widgets_values: ['visible in both contexts']
            }
          }
        ])

        await expect(
          new VueNodeHelpers(pageA).getNodeLocator(String(NODE_ID))
        ).toBeVisible()
        await expect(
          new VueNodeHelpers(pageB).getNodeLocator(String(NODE_ID))
        ).toBeVisible()
      } finally {
        await contextA.close()
        await contextB.close()
      }
    })
  }
)
