import { expect, mergeTests } from '@playwright/test'

import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { DEFAULT_BILLING_STATUS } from '@e2e/fixtures/utils/cloudBillingMocks'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

const FLAG = 'agent-free-use-message-placement'
const PLACEMENT = 'near-composer'

// `scoped_effective_has_funds` stays funded in both cases, which is the cohort
// a paywall-derived gate got wrong: the grant is spent and purchased credits
// are paying for every turn.
function billingStatus({
  grantHeld
}: {
  grantHeld: boolean
}): BillingStatusResponse {
  return {
    ...DEFAULT_BILLING_STATUS,
    scoped_effective_has_funds: { agent: true },
    scoped_has_funds: { agent: grantHeld }
  }
}

const test = mergeTests(agentTest, hostTelemetryFixture)

test.describe(
  'Agent free-use placement experiment',
  {
    tag: ['@cloud', '@agent', '@ui']
  },
  () => {
    test(
      'connects authenticated placement to the rendered notice and exposure',
      { tag: ['@screenshot'] },
      async ({ hostTelemetry, page }) => {
        await bootAgentApp(page, true, {
          features: { [FLAG]: PLACEMENT, enable_telemetry: true },
          billingStatus: billingStatus({ grantHeld: true })
        })
        const agentPanel = new AgentPanel(page)

        await agentPanel.open()

        const notice = agentPanel.root.getByRole('note', {
          name: 'Free use notice'
        })
        await expect(notice).toBeVisible()
        await expect(notice).toContainText('Try your first chat for free!')
        await expect(
          notice,
          'the retired blanket-beta sentence is not appended'
        ).not.toContainText('during BETA')
        await expect(notice).toHaveAttribute('data-placement', PLACEMENT)

        const composer = agentPanel.root.getByTestId('agent-composer')
        await expect
          .poll(async () => {
            const [noticeBox, composerBox] = await Promise.all([
              notice.boundingBox(),
              composer.boundingBox()
            ])
            return noticeBox && composerBox
              ? noticeBox.y + noticeBox.height <= composerBox.y
              : null
          })
          .toBe(true)

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

        await expect(notice).toHaveScreenshot('agent-free-use-notice.png')
      }
    )

    test('says nothing about free turns once the grant is spent', async ({
      hostTelemetry,
      page
    }) => {
      const billingRead = page.waitForResponse('**/api/billing/status')
      await bootAgentApp(page, true, {
        features: { [FLAG]: PLACEMENT, enable_telemetry: true },
        billingStatus: billingStatus({ grantHeld: false })
      })
      const agentPanel = new AgentPanel(page)

      await agentPanel.open()
      // The gate reads `/billing/status`, so a notice that renders only after
      // that response has to be given the chance to appear before the negative
      // is believable; the exposure poll waits on remote config, not on this.
      await billingRead
      await expect
        .poll(
          () =>
            hostTelemetry.filter(
              ({ event }) => event === 'app:agent_free_use_exposure'
            ).length
        )
        .toBe(1)

      await expect(
        agentPanel.root.getByRole('note', { name: 'Free use notice' })
      ).toBeHidden()
      // Suppression is render-only: the arm still reports its exposure, so the
      // denominator is unchanged whether or not this viewer was eligible.
      expect(
        hostTelemetry.filter(
          ({ event }) => event === 'app:agent_free_use_notice'
        )
      ).toEqual([])
    })
  }
)
