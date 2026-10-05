import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

const GETTING_STARTED_TITLE = enMessages.gettingStarted.title
const CARD_TESTID_PREFIX = 'getting-started-card-'

/**
 * The viewport PM-1872 was reported at: the attached staging-cloud screenshot
 * is a 2904x1828 2x capture, less the browser chrome above the app.
 */
const SIGNUP_VIEWPORT = { width: 1452, height: 828 }

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function overlap(a: Box, b: Box): { x: number; y: number } {
  return {
    x: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    y: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  }
}

async function boxOf(element: Locator): Promise<Box> {
  const box = await element.boundingBox()
  if (!box) throw new Error('element is not laid out')
  return box
}

/**
 * Arms the nudge the way the reporter did: a first-run user picks a template,
 * is offered the tour, and leaves it. Every ending arms the nudge, and an
 * ending that is not a completed walk is the "Hundreds more where that came
 * from" copy the screenshot shows.
 */
async function skipTheFirstRunTour(page: Page): Promise<void> {
  const gettingStarted = page.getByRole('dialog', {
    name: GETTING_STARTED_TITLE
  })
  await expect(gettingStarted).toBeVisible()

  const cards = page.locator(`[data-testid^="${CARD_TESTID_PREFIX}"]`)
  await expect(cards.first()).toBeVisible()
  await cards.first().click()
  await expect(gettingStarted).toBeHidden()

  const card = page.getByRole('dialog').filter({ hasText: /Step \d+ of \d+/ })
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
      'does not cover the open Agent panel on signup',
      {
        annotation: {
          type: 'regression',
          description:
            'https://linear.app/comfyorg/issue/PM-1872/test-signup-templates-pop-up-covers-part-of-the-agent-panel'
        }
      },
      async ({ page }) => {
        test.slow()
        await bootAgentApp(page, true, {
          objectInfo: 'server',
          settings: { 'Comfy.TutorialCompleted': false },
          features: {
            onboarding_tour_enabled: true,
            subscription_required: true
          }
        })

        const agentPanel = new AgentPanel(page)
        await agentPanel.open()
        await skipTheFirstRunTour(page)

        const nudge = page.getByTestId('first-run-nudge')
        await expect(nudge).toBeVisible({ timeout: 15_000 })
        // The entrance animation translates the box it is measured against.
        await expect
          .poll(() => nudge.evaluate((node) => node.getAnimations().length))
          .toBe(0)

        const [nudgeBox, panelBox] = await Promise.all([
          boxOf(nudge),
          boxOf(agentPanel.dockedPanel)
        ])

        expect(
          panelBox.width,
          'the panel has to be docked and taking layout width, or this is not the reported case'
        ).toBeGreaterThan(0)

        const covered = overlap(nudgeBox, panelBox)
        expect(
          Math.min(covered.x, covered.y),
          `the nudge covered the Agent panel by ${covered.x}x${covered.y}px, hiding its starter prompts and composer (PM-1872)`
        ).toBeLessThanOrEqual(0)
        expect(
          nudgeBox.x,
          'stepping aside must not push the nudge off the left edge'
        ).toBeGreaterThanOrEqual(0)
      }
    )
  }
)
