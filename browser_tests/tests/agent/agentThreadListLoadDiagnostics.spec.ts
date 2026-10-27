import { expect, mergeTests } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const test = mergeTests(agentTest, hostTelemetryFixture)

test.describe(
  'Agent panel thread-load diagnostics',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await bootAgentApp(page, true, {
        features: { enable_telemetry: true },
        settings: { 'Comfy.RightSidePanel.ShowErrorsTab': true },
        beforeNavigate: async (page) => {
          await page.route('**/api/agent/threads?*', (route) =>
            route.fulfill({ status: 401, body: '{"error":"unauthorized"}' })
          )
          await page.route('**/api/agent/run-mode', (route) =>
            route.fulfill(
              jsonRoute({ mode: 'ask_approval', credit_limit: null })
            )
          )
        }
      })
    })

    test('reports one bounded auth failure for a refused thread-list load', async ({
      hostTelemetry,
      hostErrorReports,
      page
    }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      await expect(agentPanel.root.getByTestId('agent-composer')).toBeVisible()

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
            operation: 'list_threads',
            request_path: '/agent/threads',
            request_status: 401,
            request_error: 'AgentApiError'
          }
        })
      expect(
        hostErrorReports.filter(
          ({ properties }) =>
            properties.error_type === 'agent_thread_list_load_failed'
        )
      ).toHaveLength(0)

      const properties = JSON.stringify([
        hostTelemetry.map(({ properties }) => properties),
        hostErrorReports.map(({ properties }) => properties)
      ])
      expect(properties).not.toContain('unauthorized')
      expect(properties).not.toContain('/api/agent/threads')
    })
  }
)
