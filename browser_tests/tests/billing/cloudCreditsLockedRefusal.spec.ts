import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { BillingEventsResponse } from '@comfyorg/ingest-types'

import { mockCloudComfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import {
  DEFAULT_TEAM_MEMBERS,
  INACTIVE_TEAM_BILLING_STATUS,
  PERSONAL_BILLING_STATUS,
  TEAM_MEMBER_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { expectPlatformPlansOpened } from '@e2e/fixtures/utils/platformPlans'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const FREE_ACCOUNT_WITH_CREDITS = {
  ...PERSONAL_BILLING_STATUS,
  is_active: true,
  subscription_status: undefined
}

test.describe('Billing rollout', () => {
  for (const release of [
    {
      version: '1.60',
      enabled: false,
      memberColumns: 0,
      primaryAction: 'Add credits',
      newDialogs: 0,
      legacy160Markers: 1
    },
    {
      version: '1.61',
      enabled: true,
      memberColumns: 1,
      primaryAction: 'Continue',
      newDialogs: 1,
      legacy160Markers: 0
    }
  ]) {
    test.describe(
      `Billing ${release.version} selected by /features`,
      { tag: '@cloud' },
      () => {
        test.use({ billingNewUx: false })

        test('selects the release Billing tab', async ({ comfyPage }) => {
          const { page } = comfyPage
          test.setTimeout(60_000)
          const billing = new CloudWorkspaceMockHelper(page)
          await billing.setup(
            DEFAULT_TEAM_MEMBERS,
            workspace('personal', 'owner'),
            {
              ...PERSONAL_BILLING_STATUS,
              billing_status: 'paid',
              is_active: true,
              subscription_status: 'active',
              subscription_tier: 'PRO',
              subscription_duration: 'MONTHLY',
              plan_slug: 'pro-monthly'
            }
          )
          await page.route('**/api/features', (route) =>
            route.fulfill(
              jsonRoute({
                billing_new_ux_enabled: release.enabled,
                unified_billing_settings: true
              })
            )
          )
          await page.route('**/api/billing/payment-methods', (route) =>
            route.fulfill(jsonRoute([]))
          )

          const content = await billing.openPlanAndCreditsSettings('Billing')
          const tab = content.getByTestId('billing-tab')
          await expect(tab).toBeVisible()
          await expect(tab.getByTestId('billing-plan-row')).toBeVisible()
          await expect(
            content.locator('[data-billing-release="1.60"]')
          ).toHaveCount(release.legacy160Markers)
        })

        test('selects the release Activity columns and Add credits UI from the same account facts', async ({
          comfyPage
        }) => {
          const { page } = comfyPage
          test.setTimeout(60_000)
          const billing = new CloudWorkspaceMockHelper(page)
          await billing.setup(
            DEFAULT_TEAM_MEMBERS,
            workspace('personal', 'owner'),
            {
              ...PERSONAL_BILLING_STATUS,
              billing_status: 'paid',
              is_active: true,
              subscription_status: 'active',
              subscription_tier: 'PRO',
              subscription_duration: 'MONTHLY',
              plan_slug: 'pro-monthly'
            }
          )
          await page.route('**/api/features', (route) =>
            route.fulfill(
              jsonRoute({ billing_new_ux_enabled: release.enabled })
            )
          )
          const events: BillingEventsResponse = {
            events: [
              {
                event_id: 'billing-rollout-event',
                event_type: 'api_usage_completed',
                createdAt: '2026-11-10T12:00:00Z',
                params: { api_name: 'Rollout test node' },
                member_display_name: 'Ada Lovelace'
              }
            ],
            page: 1,
            limit: 7,
            total: 1,
            totalPages: 1
          }
          await page.route('**/api/billing/events**', (route) =>
            route.fulfill(jsonRoute(events))
          )
          await page.route('**/api/billing/payment-methods', (route) =>
            route.fulfill(jsonRoute([]))
          )
          await page.route('**/api/billing/topup/quote', (route) =>
            route.fulfill(jsonRoute({ credits: 1000 }))
          )

          const content = await billing.openPlanAndCreditsSettings()
          await expect(
            content.locator('[data-billing-release="1.60"]')
          ).toHaveCount(release.legacy160Markers)
          await content
            .getByRole('button', { name: 'Activity', exact: true })
            .click()
          await expect(content.getByText('Rollout test node')).toBeVisible()
          await expect(
            content.getByRole('columnheader', { name: 'Member' })
          ).toHaveCount(release.memberColumns)
          await expect(content.getByText('Ada Lovelace')).toHaveCount(
            release.memberColumns
          )

          await content
            .getByRole('button', { name: 'Credits', exact: true })
            .click()
          await content
            .getByRole('button', { name: 'Add credits', exact: true })
            .click()

          const dialog = page.locator('[data-dialog-key="top-up-credits"]')
          await expect(dialog).toBeVisible()
          await expect(
            dialog.getByRole('button', {
              name: release.primaryAction,
              exact: true
            })
          ).toBeVisible()
          await expect(dialog.getByTestId('add-credits-dialog')).toHaveCount(
            release.newDialogs
          )
        })
      }
    )
  }
})

interface RunRefusal {
  type: string
  message: string
  credits_locked?: boolean
  reason?: string
}

async function runAndGetRefusedWith(page: Page, error: RunRefusal) {
  await page.route('**/api/prompt', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          ...jsonRoute({ node_errors: {}, error }),
          status: 402
        })
      : route.fallback()
  )

  await page.goto(APP_URL)
  await waitForCloudApp(page)

  await page.getByTestId(TestIds.topbar.queueButton).click()
}

function runAndGetRefused(page: Page, creditsLocked: boolean) {
  return runAndGetRefusedWith(page, {
    type: 'CLOUD_SUBSCRIPTION_REQUIRED',
    message: 'A cloud subscription is required to queue workflows.',
    credits_locked: creditsLocked
  })
}

const PROMPT_GATE_REFUSAL = {
  type: 'PAYMENT_REQUIRED',
  message: 'Subscription or credits required to queue workflows'
}

const BLOCKED_RUN_REFUSALS = [
  {
    reason: 'manual_block',
    body: 'This workspace has been blocked. Contact support.'
  },
  {
    reason: 'workspace_cap_exceeded',
    body: 'This workspace has reached its spending limit.'
  },
  {
    reason: 'project_cap_exceeded',
    body: 'This project has reached its spending limit.'
  },
  {
    reason: 'user_cap_exceeded',
    body: "You've reached your spending limit in this workspace."
  }
]

async function arrangeRunnableWorkspaceWithoutPlan(page: Page) {
  await new CloudWorkspaceMockHelper(page).setup(
    DEFAULT_TEAM_MEMBERS,
    workspace('personal', 'owner'),
    { ...FREE_ACCOUNT_WITH_CREDITS, subscription_state: 'ended' },
    { can_run_workflows: true }
  )
  await page.route('**/api/features', (route) =>
    route.fulfill(jsonRoute({ subscription_required: true }))
  )
}

test.describe(
  'Run refused by the prompt gate with a served reason',
  { tag: '@cloud' },
  () => {
    test('opens the plans dialog when the reason is an inactive subscription', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await arrangeRunnableWorkspaceWithoutPlan(page)

      await runAndGetRefusedWith(page, {
        ...PROMPT_GATE_REFUSAL,
        reason: 'subscription_inactive'
      })

      const dialog = page.getByTestId('platform-plans-link-dialog')
      await expect(dialog.getByText("Your workflow didn't run")).toBeVisible()
      await expect(
        dialog.getByRole('link', { name: 'Choose a plan' })
      ).toBeVisible()
    })

    test('opens Add credits when the reason is no funds', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await arrangeRunnableWorkspaceWithoutPlan(page)

      await runAndGetRefusedWith(page, {
        ...PROMPT_GATE_REFUSAL,
        reason: 'no_funds'
      })

      await expect(page.getByTestId('add-credits-dialog')).toBeVisible()
      await expect(page.getByTestId('platform-plans-link-dialog')).toBeHidden()
    })

    for (const { reason, body } of BLOCKED_RUN_REFUSALS) {
      test(`explains a run refused for ${reason}`, async ({ comfyPage }) => {
        const { page } = comfyPage
        await arrangeRunnableWorkspaceWithoutPlan(page)

        await runAndGetRefusedWith(page, { ...PROMPT_GATE_REFUSAL, reason })

        const errorDialog = page.getByTestId('error-dialog')
        await expect(
          errorDialog.getByRole('heading', { name: "Your workflow didn't run" })
        ).toBeVisible()
        await expect(errorDialog.getByText(body, { exact: true })).toBeVisible()
        await expect(
          page.getByTestId('platform-plans-link-dialog')
        ).toBeHidden()
        await expect(page.getByTestId('add-credits-dialog')).toBeHidden()
      })
    }

    test('opens no account dialog when no reason is served', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await arrangeRunnableWorkspaceWithoutPlan(page)

      await runAndGetRefusedWith(page, PROMPT_GATE_REFUSAL)

      await expect(page.getByText(PROMPT_GATE_REFUSAL.message)).toBeVisible()
      await expect(page.getByTestId('platform-plans-link-dialog')).toBeHidden()
      await expect(page.getByTestId('add-credits-dialog')).toBeHidden()
    })
  }
)

test.describe(
  'Run refused for a blocked workspace with the Issues tab on',
  { tag: '@cloud' },
  () => {
    for (const { billingNewUx, title, body } of [
      {
        billingNewUx: true,
        title: "Your workflow didn't run",
        body: 'This workspace has been blocked. Contact support.'
      },
      {
        billingNewUx: false,
        title: PROMPT_GATE_REFUSAL.message,
        body: PROMPT_GATE_REFUSAL.message
      }
    ]) {
      test.describe(`billing_new_ux_enabled: ${billingNewUx}`, () => {
        test.use({ billingNewUx })

        test('explains the refusal on the error card', async ({
          comfyPage
        }) => {
          const { page } = comfyPage
          await arrangeRunnableWorkspaceWithoutPlan(page)
          await page.route('**/api/settings', (route) =>
            route.fulfill(
              jsonRoute({
                'Comfy.TutorialCompleted': true,
                'Comfy.RightSidePanel.ShowErrorsTab': true
              })
            )
          )
          await page.route('**/api/prompt', (route) =>
            route.request().method() === 'POST'
              ? route.fulfill({
                  ...jsonRoute({
                    node_errors: {},
                    error: { ...PROMPT_GATE_REFUSAL, reason: 'manual_block' }
                  }),
                  status: 402
                })
              : route.fallback()
          )
          await page.goto(APP_URL)
          await waitForCloudApp(page)
          await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')

          await page.getByTestId(TestIds.topbar.queueButton).click()

          const card = page.getByTestId('error-overlay')
          await expect(card.getByRole('paragraph')).toHaveText(body)
          await expect(card).toContainText(title)
        })
      })
    }
  }
)

test.describe('Run refused without a plan', { tag: '@cloud' }, () => {
  test.describe('as a workspace owner', () => {
    test.beforeEach(async ({ page }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        workspace('personal', 'owner'),
        {
          ...FREE_ACCOUNT_WITH_CREDITS,
          subscription_state: 'never_subscribed'
        },
        { can_run_workflows: true }
      )
      await page.route('**/api/features', (route) =>
        route.fulfill(
          jsonRoute({
            subscription_required: true,
            free_tier_balance: { allowance: 5, remaining: 0, used: 5 }
          })
        )
      )
    })

    test('explains that the owner has used all free runs', async ({ page }) => {
      await runAndGetRefused(page, true)

      const dialog = page.getByTestId('platform-plans-link-dialog')
      await expect(
        dialog.getByText(
          "You've used all 5 free runs. Subscribe to keep running workflows on Cloud."
        )
      ).toBeVisible()
      await expectPlatformPlansOpened(page, () =>
        dialog.getByRole('link', { name: 'Choose a plan' }).click()
      )
    })
  })

  test.describe('as a workspace member', () => {
    test.beforeEach(async ({ page }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        TEAM_MEMBER_WORKSPACE,
        INACTIVE_TEAM_BILLING_STATUS,
        { can_run_workflows: true }
      )
      await page.route('**/api/features', (route) =>
        route.fulfill(jsonRoute({ subscription_required: true }))
      )
    })

    test('tells a member to ask their workspace owner after a refused run', async ({
      page
    }) => {
      await runAndGetRefused(page, true)

      await expect(
        page.getByRole('dialog').getByText(/ask your workspace owner/i)
      ).toBeVisible()
      await expect(page.getByTestId('platform-plans-link-dialog')).toBeHidden()
    })
  })

  const ROWS = [
    {
      subscriptionState: 'never_subscribed',
      body: 'Running workflows on Cloud needs a plan.'
    },
    {
      subscriptionState: 'ended',
      body: 'Your plan has ended. Resubscribe to keep running workflows on Cloud.'
    }
  ] as const

  for (const { subscriptionState, body } of ROWS) {
    for (const creditsLocked of [true, false]) {
      test(`explains the refused run and links to the Plans page (${subscriptionState}, credits_locked: ${creditsLocked})`, async ({
        comfyPage
      }) => {
        const { page } = comfyPage
        await new CloudWorkspaceMockHelper(page).setup(
          DEFAULT_TEAM_MEMBERS,
          workspace('personal', 'owner'),
          {
            ...FREE_ACCOUNT_WITH_CREDITS,
            subscription_state: subscriptionState
          },
          { can_run_workflows: true }
        )
        await page.route('**/api/features', (route) =>
          route.fulfill(jsonRoute({ subscription_required: true }))
        )
        const tabsBeforeRun = page.context().pages().length

        await runAndGetRefused(page, creditsLocked)

        const dialog = page.getByTestId('platform-plans-link-dialog')
        await expect(dialog).toBeVisible()
        await expect(dialog.getByText("Your workflow didn't run")).toBeVisible()
        await expect(dialog.getByText(body)).toBeVisible()
        expect(
          page.context().pages(),
          'the refusal opens no tab on its own'
        ).toHaveLength(tabsBeforeRun)

        await expectPlatformPlansOpened(page, () =>
          dialog.getByRole('link', { name: 'Choose a plan' }).click()
        )
        await expect(dialog).toBeHidden()
      })
    }
  }
})

test.describe(
  '1.60 billing with the new UX disabled',
  { tag: '@cloud' },
  () => {
    test.use({ billingNewUx: false })

    test('hands a refused run directly to Plans without the 1.61 explanation', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        workspace('personal', 'owner'),
        {
          ...FREE_ACCOUNT_WITH_CREDITS,
          subscription_state: 'never_subscribed'
        },
        { can_run_workflows: true }
      )
      await page.route('**/api/features', (route) =>
        route.fulfill(jsonRoute({ subscription_required: true }))
      )

      await expectPlatformPlansOpened(page, () => runAndGetRefused(page, true))

      await expect(page.getByTestId('platform-plans-link-dialog')).toBeHidden()
    })

    test('keeps a prompt-gate refusal as a toast even when a reason is served', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await arrangeRunnableWorkspaceWithoutPlan(page)
      const tabsBeforeRun = page.context().pages().length

      await runAndGetRefusedWith(page, {
        ...PROMPT_GATE_REFUSAL,
        reason: 'subscription_inactive'
      })

      await expect(page.getByText(PROMPT_GATE_REFUSAL.message)).toBeVisible()
      await expect(page.getByTestId('platform-plans-link-dialog')).toBeHidden()
      expect(page.context().pages()).toHaveLength(tabsBeforeRun)
    })

    test('keeps the message Cloud sent for a blocked workspace', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await arrangeRunnableWorkspaceWithoutPlan(page)

      await runAndGetRefusedWith(page, {
        ...PROMPT_GATE_REFUSAL,
        reason: 'manual_block'
      })

      const errorDialog = page.getByTestId('error-dialog')
      await expect(
        errorDialog.getByRole('heading', { name: 'Prompt execution failed' })
      ).toBeVisible()
      await expect(
        errorDialog.getByText(PROMPT_GATE_REFUSAL.message, { exact: true })
      ).toBeVisible()
      await expect(page.getByText("Your workflow didn't run")).toBeHidden()
    })
  }
)

async function arrangeEndedPlan(page: Page, hasFunds: boolean) {
  await new CloudWorkspaceMockHelper(page).setup(
    DEFAULT_TEAM_MEMBERS,
    workspace('personal', 'owner'),
    {
      ...PERSONAL_BILLING_STATUS,
      subscription_state: 'ended',
      has_funds: hasFunds
    }
  )
  await page.route('**/api/features', (route) =>
    route.fulfill(jsonRoute({ subscription_required: true }))
  )
}

async function clickSubscribeToRun(page: Page) {
  await page.goto(APP_URL)
  await waitForCloudApp(page)
  await page.getByTestId(TestIds.topbar.subscribeToRunButton).click()
}

test.describe('Subscribe to Run for an ended plan', { tag: '@cloud' }, () => {
  for (const hasFunds of [true, false]) {
    test(`opens the platform Plans page (has_funds: ${hasFunds})`, async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await arrangeEndedPlan(page, hasFunds)

      await expectPlatformPlansOpened(page, () => clickSubscribeToRun(page))
    })
  }
})
