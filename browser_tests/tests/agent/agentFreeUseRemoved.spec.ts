import { expect, mergeTests } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

// Christian ruled Agent was never free during beta (blocked-on-christian#965).
// This proves the removal end to end: even a server still serving the
// retired `agent-free-use-message-placement` flag value must not produce the
// notice, its copy, or its exposure telemetry anywhere in the rendered panel.
const RETIRED_FLAG = 'agent-free-use-message-placement'

const test = mergeTests(agentTest, hostTelemetryFixture)

test.describe(
  'Agent free-use notice removal',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test('renders no free-use notice, copy, or exposure telemetry even if the retired flag is still served', async ({
      hostTelemetry,
      page
    }) => {
      await bootAgentApp(page, true, {
        features: {
          [RETIRED_FLAG]: 'near-composer',
          enable_telemetry: true
        }
      })
      const agentPanel = new AgentPanel(page)

      await agentPanel.open()

      await expect(
        agentPanel.root.getByRole('note', { name: 'Free use notice' })
      ).toHaveCount(0)
      await expect(agentPanel.root).not.toContainText('FREE during BETA')
      await expect(agentPanel.root).not.toContainText('free use notice', {
        ignoreCase: true
      })

      const composer = agentPanel.root.getByTestId('agent-composer')
      await expect(composer).toBeVisible()

      expect(
        hostTelemetry.some(
          ({ event }) =>
            event === 'app:agent_free_use_exposure' ||
            event === 'app:agent_free_use_notice'
        )
      ).toBe(false)
    })
  }
)
