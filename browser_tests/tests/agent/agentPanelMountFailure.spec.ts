import { expect, mergeTests } from '@playwright/test'

import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture, hostTelemetryFixture)

test.describe(
  'Agent panel content that fails to mount',
  {
    tag: '@cloud',
    annotation: {
      type: 'issue',
      description:
        'OBL-234, reported in Slack C0C79ELJQ8G thread 1792522182.415769: the agent panel opened on Desktop but its content stayed blank'
    }
  },
  () => {
    test.use({
      connectWebSocketToServer: false,
      initialFeatureFlags: { enable_telemetry: true },
      initialLocalStorage: {
        'Comfy.Agent.WorkflowTabBindings:personal': 'null'
      }
    })

    test('shows a retryable error instead of a blank panel and reports the stall stage', async ({
      agentPanel,
      hostTelemetry
    }) => {
      await agentPanel.openDock()

      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(agentPanel.loadFailedMessage).toBeVisible()
      await expect(agentPanel.loadRetryButton).toBeVisible()
      await expect
        .poll(() =>
          hostTelemetry.filter(
            ({ event }) => event === 'app:agent_panel_render_stalled'
          )
        )
        .toEqual([
          {
            event: 'app:agent_panel_render_stalled',
            properties: { stage: 'root_resolved_not_mounted' }
          }
        ])
    })
  }
)
