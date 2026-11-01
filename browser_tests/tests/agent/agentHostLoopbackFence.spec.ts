import type { Page } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

const test = mergeTests(agentTest, hostTelemetryFixture)

const LOOPBACK_ONLY_BODY = JSON.stringify({
  error:
    'The agent only works when ComfyUI is opened on the computer it runs on, by a local address. Open http://127.0.0.1:8188 in a browser on that computer to use the agent.',
  code: 'agent_loopback_only'
})

const REFUSED_FILE = {
  name: 'doc.pdf',
  type: 'application/pdf',
  contents: '%PDF'
}

const WORKFLOW_FILE = {
  name: 'dropped.json',
  type: 'application/json',
  contents: JSON.stringify({
    last_node_id: 1,
    last_link_id: 0,
    nodes: [
      {
        id: 1,
        type: 'PreviewImage',
        pos: [40, 40],
        size: [210, 250],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [{ name: 'images', type: 'IMAGE', link: null }],
        outputs: [],
        properties: {}
      }
    ],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  })
}

const graphNodeCount = (page: Page): Promise<number> =>
  page.evaluate(() => window.app?.graph.nodes.length ?? 0)

const FENCED_ROUTES = [
  '**/api/agent/threads?*',
  '**/api/agent/run-mode',
  '**/api/agent/identity'
] as const

test.describe(
  'Agent panel host loopback fence',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('shows the host’s reason on open rather than its empty state', async ({
      hostErrorReports,
      page
    }) => {
      await bootAgentApp(page, true, {
        features: { enable_telemetry: true },
        beforeNavigate: async (page) => {
          for (const route of FENCED_ROUTES)
            await page.route(route, (r) =>
              r.fulfill({ status: 403, body: LOOPBACK_ONLY_BODY })
            )
        }
      })
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      await expect(agentPanel.hostFenceNotice).toBeVisible()
      await expect(agentPanel.hostFenceNotice).toHaveText(
        'The agent only works when ComfyUI is opened on the computer it runs on, by a local address. Open http://127.0.0.1:8188 in a browser on that computer to use the agent.'
      )
      await expect(agentPanel.hostFenceNotice).toHaveAttribute('role', 'alert')
      await expect(agentPanel.chatControls).toHaveAttribute('inert', '')
      await expect(agentPanel.footer).toHaveAttribute('inert', '')

      const nodesBeforeDrop = await graphNodeCount(page)
      await agentPanel.dispatchFileDrop(REFUSED_FILE)
      await agentPanel.dispatchFileDrop(WORKFLOW_FILE)
      await expect(agentPanel.attachmentChips).toHaveCount(0)
      await expect.poll(() => graphNodeCount(page)).toBe(nodesBeforeDrop)
      await expect(agentPanel.hostFenceNotice).toBeVisible()

      await expect
        .poll(() =>
          hostErrorReports.find(
            ({ properties }) =>
              properties.error_type === 'agent_thread_list_load_failed'
          )
        )
        .toMatchObject({ properties: { request_status: 403 } })
      expect(
        hostErrorReports.filter(
          ({ properties }) =>
            properties.error_type === 'agent_api_auth_rejected'
        )
      ).toHaveLength(0)
    })

    test('leaves a real auth failure out of that notice', async ({
      hostErrorReports,
      page
    }) => {
      await bootAgentApp(page, true, {
        features: { enable_telemetry: true },
        beforeNavigate: async (page) => {
          for (const route of FENCED_ROUTES)
            await page.route(route, (r) =>
              r.fulfill({ status: 401, body: '{"error":"unauthorized"}' })
            )
        }
      })
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      await expect(agentPanel.composer).toBeVisible()
      await expect(agentPanel.hostFenceNotice).toHaveCount(0)
      await expect(agentPanel.chatControls).not.toHaveAttribute('inert')
      await expect(agentPanel.footer).not.toHaveAttribute('inert')

      await agentPanel.dispatchFileDrop(REFUSED_FILE)
      await expect(agentPanel.attachmentChips).toHaveCount(1)
      await expect
        .poll(() =>
          hostErrorReports.find(
            ({ properties }) =>
              properties.error_type === 'agent_api_auth_rejected'
          )
        )
        .toMatchObject({
          properties: {
            error_type: 'agent_api_auth_rejected',
            surface: 'agent',
            request_status: 401
          }
        })
    })
  }
)
