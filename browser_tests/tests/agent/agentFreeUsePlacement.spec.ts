import { expect, mergeTests } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

const FLAG = 'agent-free-use-message-placement'
const PLACEMENT = 'near-composer'

const test = mergeTests(agentTest, hostTelemetryFixture)

test.describe(
  'Agent free-use placement experiment',
  {
    tag: ['@cloud', '@agent', '@ui']
  },
  () => {
    test('connects authenticated placement to the rendered notice and exposure', async ({
      hostTelemetry,
      page
    }) => {
      await bootAgentApp(page, true, {
        features: { [FLAG]: PLACEMENT, enable_telemetry: true }
      })
      const agentPanel = new AgentPanel(page)

      await agentPanel.open()

      const notice = agentPanel.root.getByRole('note', {
        name: 'Free use notice'
      })
      await expect(notice).toBeVisible()
      await expect(notice).toHaveAttribute('data-placement', PLACEMENT)

      const composer = agentPanel.root.getByTestId('agent-composer')
      const [noticeBox, composerBox] = await Promise.all([
        notice.boundingBox(),
        composer.boundingBox()
      ])
      expect(noticeBox).not.toBeNull()
      expect(composerBox).not.toBeNull()
      expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(
        composerBox!.y
      )

      await expect
        .poll(() =>
          hostTelemetry.find(
            ({ event }) => event === 'app:agent_free_use_exposure'
          )
        )
        .toEqual({
          event: 'app:agent_free_use_exposure',
          properties: {
            [`$feature/${FLAG}`]: PLACEMENT,
            placement: PLACEMENT
          }
        })
    })
  }
)
