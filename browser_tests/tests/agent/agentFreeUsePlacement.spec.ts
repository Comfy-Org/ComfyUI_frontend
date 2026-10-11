import { expect, mergeTests } from '@playwright/test'

import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

const FLAG = 'agent-free-use-message-placement'
const PLACEMENT = 'near-composer'

/**
 * `Try your first chat for free!` is a claim about the Agent's own granted
 * allowance, so the notice renders on `scoped_has_funds.agent` and nothing
 * else. `scoped_effective_has_funds` stays funded in both cases below, which is
 * exactly the cohort a paywall-derived gate got wrong: the grant is spent and
 * purchased credits are paying for every turn.
 */
function billingStatus(grantHeld: boolean): BillingStatusResponse {
  return {
    is_active: true,
    has_funds: true,
    scoped_effective_has_funds: { agent: true },
    scoped_has_funds: { agent: grantHeld },
    subscription_status: 'active',
    subscription_tier: 'PRO',
    subscription_duration: 'MONTHLY',
    billing_status: 'paid',
    max_seats: 1,
    occupied_seats: 1,
    team_credit_stop: null,
    scheduled_change: null
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
          billingStatus: billingStatus(true)
        })
        const agentPanel = new AgentPanel(page)

        await agentPanel.open()

        const notice = agentPanel.root.getByRole('note', {
          name: 'Free use notice'
        })
        await expect(notice).toBeVisible()
        await expect(notice).toContainText('Try your first chat for free!')
        // `toContainText` is a substring match, so this catches the retired
        // blanket-beta sentence coming back *alongside* the bounded one.
        await expect(notice).not.toContainText('during BETA')
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

        // The only PR-gated visual coverage of this surface: Chromatic runs on
        // version-bump branches only, so the light-theme story exports are not
        // a gate here. Element-level, so panel chrome cannot churn it.
        await expect(notice).toHaveScreenshot('agent-free-use-notice.png')
      }
    )

    test('says nothing about free turns once the grant is spent', async ({
      hostTelemetry,
      page
    }) => {
      await bootAgentApp(page, true, {
        features: { [FLAG]: PLACEMENT, enable_telemetry: true },
        billingStatus: billingStatus(false)
      })
      const agentPanel = new AgentPanel(page)

      await agentPanel.open()
      await expect(agentPanel.root.getByTestId('agent-composer')).toBeVisible()

      await expect(
        agentPanel.root.getByRole('note', { name: 'Free use notice' })
      ).toBeHidden()
      // Suppression is render-only: the arm still reports its exposure, so the
      // denominator is unchanged whether or not this viewer was eligible.
      await expect
        .poll(
          () =>
            hostTelemetry.filter(
              ({ event }) => event === 'app:agent_free_use_exposure'
            ).length
        )
        .toBe(1)
      expect(
        hostTelemetry.filter(
          ({ event }) => event === 'app:agent_free_use_notice'
        )
      ).toEqual([])
    })
  }
)
