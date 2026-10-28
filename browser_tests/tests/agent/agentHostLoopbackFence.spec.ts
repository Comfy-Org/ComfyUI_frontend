import { expect, mergeTests } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

const test = mergeTests(agentTest, hostTelemetryFixture)

/**
 * The local agent host's loopback fence: ComfyUI was opened by an address that
 * is not on the machine the agent runs on, so every agent request is refused
 * with `{ error, code: "agent_loopback_only" }` (Comfy-Org/cloud#14874).
 *
 * The refusal lands on the panel's own opening reads, before any turn exists,
 * which is what made the defect invisible: with ComfyUI started `--listen` and
 * the panel opened by the machine's LAN address, the panel sat in its ordinary
 * empty state while threads, identity and run mode all came back 403, each
 * reported as an authentication rejection.
 */
const LOOPBACK_ONLY_BODY = JSON.stringify({
  error:
    'The agent only works when ComfyUI is opened on the computer it runs on, by a local address. Open http://127.0.0.1:8188 in a browser on that computer to use the agent.',
  code: 'agent_loopback_only'
})
const LOOPBACK_ONLY_MESSAGE =
  'The agent only works when ComfyUI is opened on the computer it runs on, by a local address. Open http://127.0.0.1:8188 in a browser on that computer to use the agent.'

/** Everything the panel reads on open, all of which the fence answers. */
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
      await expect(agentPanel.hostFenceNotice).toHaveText(LOOPBACK_ONLY_MESSAGE)
      await expect(agentPanel.hostFenceNotice).toHaveAttribute('role', 'alert')

      // The refusal is not an auth outcome: no credential would have changed
      // it, so it must not be counted as one. Waiting for the load's own
      // report first is what makes the absence meaningful - a bare
      // `toHaveLength(0)` passes before any report has been sent at all.
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
