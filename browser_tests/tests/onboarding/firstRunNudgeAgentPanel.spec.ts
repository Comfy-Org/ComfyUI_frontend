import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { OnboardingCoachmarks } from '@e2e/fixtures/components/Tour'

const GETTING_STARTED_TITLE = enMessages.gettingStarted.title

const SIGNUP_VIEWPORT = { width: 1452, height: 828 }

async function settledBox(element: Locator) {
  await expect
    .poll(() => element.evaluate((node) => node.getAnimations().length))
    .toBe(0)
  const box = await element.boundingBox()
  if (!box) throw new Error('element is not laid out')
  return box
}

async function skipTheFirstRunTour(page: Page): Promise<void> {
  const gettingStarted = page.getByRole('dialog', {
    name: GETTING_STARTED_TITLE
  })
  await expect(gettingStarted).toBeVisible()

  const cards = page.locator(
    '[data-testid^="getting-started-card-"]:not([data-testid*="-skeleton-"])'
  )
  await expect(cards.first()).toBeVisible()
  await cards.first().click()
  await expect(gettingStarted).toBeHidden()

  const { card } = new OnboardingCoachmarks(page)
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(card).toBeHidden()
}

test.describe(
  'First-run nudge beside the Agent panel',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test.use({ viewport: SIGNUP_VIEWPORT })

    test(
      'stays clear of the open Agent panel',
      {
        annotation: {
          type: 'regression',
          description:
            'https://linear.app/comfyorg/issue/PM-1872/test-signup-templates-pop-up-covers-part-of-the-agent-panel'
        }
      },
      async ({ page }) => {
        await bootAgentApp(page, true, {
          objectInfo: 'server',
          settings: { 'Comfy.TutorialCompleted': false },
          features: {
            onboarding_tour_enabled: true,
            subscription_required: true
          }
        })

        await skipTheFirstRunTour(page)

        const agentPanel = new AgentPanel(page)
        await agentPanel.open()
        await expect(
          page.getByTestId('agent-panel-resize-handle'),
          'the reported case requires a docked, non-overlay Agent panel'
        ).toBeVisible()

        const nudge = page.getByTestId('first-run-nudge')
        await expect(nudge).toBeVisible()

        const nudgeBox = await settledBox(nudge)
        const panelBox = await settledBox(agentPanel.dockedPanel)

        expect(
          nudgeBox.x + nudgeBox.width,
          'the nudge must sit left of the docked Agent panel, not over its starter prompts and composer (PM-1872)'
        ).toBeLessThanOrEqual(panelBox.x)
      }
    )
  }
)
