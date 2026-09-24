import { expect } from '@playwright/test'

import {
  crossOriginSessionFixture as test,
  sessionEndpoint,
  signInOnCloud
} from '@e2e/fixtures/crossOriginSessionFixture'
import { SessionTab } from '@e2e/fixtures/helpers/SessionTab'

function entryLink(intent: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams({
    product: 'comfyui',
    return_to: 'comfyui_workspace',
    ...params
  })
  return `/v1/${intent}?${search}`
}

const PLAN = 'standard-monthly'

// Milestone 2 QA plan cases SS1-SS6 and SO1-SO6, restated for billing-web on
// the shared session.
test.describe(
  'Cross-origin session, billing-web handoff',
  { tag: ['@session', '@flag-on'] },
  () => {
    test('[SS1] signed in on Cloud, Subscribe opens billing-web checkout with no sign-in form', async ({
      cloudTab,
      billingTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2898 billing-web on session; C3 BE-17063, C5 BE-17066, C11 BE-17136 on staging'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      await billingTab.goto(entryLink('checkout', { plan: PLAN }))
      await expect(billingTab.page).not.toHaveURL(/\/sign-in/)
      billingTab.firebaseCalls.expectNone(
        'Firebase Auth calls from billing-web'
      )
    })

    test('[SS2] signed in on both, Subscribe keeps the plan and workspace the app sent', async ({
      cloudTab,
      billingTab,
      sessionAccount,
      teamWorkspaceId
    }) => {
      test.fixme(true, 'FE-2898 billing-web on session; C5 BE-17066 on staging')
      await signInOnCloud(cloudTab, sessionAccount)
      const [workspaceId] = await Promise.all([
        billingTab.nextWorkspaceId(cloudTab.origin),
        billingTab.goto(
          entryLink('checkout', { plan: PLAN, workspace: teamWorkspaceId })
        )
      ])
      expect(workspaceId).toBe(teamWorkspaceId)
      await expect(billingTab.page).toHaveURL(new RegExp(`plan=${PLAN}`))
    })

    test("[SS3] different accounts on billing-web and Cloud end on the session's one identity with a notice", async ({
      cloudTab,
      billingTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2898 billing-web on session, FE-2903 account-switch notice (open question 11); a second staging account'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const read = billingTab.waitForResponse('GET', sessionEndpoint(cloudTab))
      await billingTab.goto(entryLink('pricing'))
      expect(await (await read).text()).toContain(sessionAccount.email)
    })

    test('[SS4] signing out of Cloud signs billing-web out too', async ({
      cloudTab,
      billingTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2898 billing-web on session, FE-2897 lifecycle; C1 BE-17061 on staging'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      await billingTab.goto(entryLink('subscription'))
      const signOut = cloudTab.waitForResponse(
        'DELETE',
        sessionEndpoint(cloudTab)
      )
      expect((await signOut).ok()).toBe(true)
      await billingTab.page.reload()
      await expect(billingTab.page).toHaveURL(/\/sign-in/)
    })

    test('[SS5] an expiring workspace token mid-checkout recovers with no sign-in prompt', async ({
      cloudTab,
      billingTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2898 billing-web on session, FE-2895 authorize(); C5 BE-17066 on staging'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      await billingTab.goto(entryLink('checkout', { plan: PLAN }))
      await billingTab.page.evaluate(() => sessionStorage.clear())
      await billingTab.page.reload()
      await expect(billingTab.page).not.toHaveURL(/\/sign-in/)
    })

    test('[SS6] a second entry link opens a second billing-web tab in its own workspace', async ({
      context,
      cloudTab,
      billingTab,
      sessionAccount,
      teamWorkspaceId
    }) => {
      test.fixme(
        true,
        'FE-2898 billing-web on session, FE-2895 workspace header; C5 BE-17066 on staging'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const teamTab = new SessionTab(await context.newPage(), billingTab.origin)
      const [personal, team] = await Promise.all([
        billingTab.nextWorkspaceId(cloudTab.origin),
        teamTab.nextWorkspaceId(cloudTab.origin),
        billingTab.goto(entryLink('subscription')),
        teamTab.goto(entryLink('subscription', { workspace: teamWorkspaceId }))
      ])
      expect(team).toBe(teamWorkspaceId)
      expect(personal).not.toBe(teamWorkspaceId)
    })

    test('[SO1] signed out, a checkout link keeps every parameter through sign-in', async ({
      billingTab
    }) => {
      test.fixme(true, 'FE-2898 billing-web on session; C3 BE-17063 on staging')
      await billingTab.goto(entryLink('checkout', { plan: PLAN }))
      await expect(billingTab.page).toHaveURL(
        new RegExp(`/sign-in\\?returnTo=.*plan%3D${PLAN}`)
      )
    })

    test('[SO2] signed out, subscription, payment-method and result links keep their parameters', async ({
      billingTab
    }) => {
      test.fixme(true, 'FE-2898 billing-web on session; C3 BE-17063 on staging')
      for (const intent of ['subscription', 'payment-methods', 'result']) {
        await billingTab.goto(entryLink(intent))
        await expect(billingTab.page).toHaveURL(
          new RegExp(`/sign-in\\?returnTo=.*${intent}`)
        )
      }
    })

    test('[SO3] an abandoned sign-in stays on sign-in with a way to retry', async ({
      billingTab
    }) => {
      test.fixme(true, 'FE-2898 billing-web on session')
      await billingTab.goto(entryLink('pricing'))
      await expect(billingTab.page).toHaveURL(/\/sign-in/)
      billingTab.sessionCalls.expectNone('Session writes before any sign-in')
    })

    test("[SO4] signing in as a non-member shows the can't-access copy and never personal data", async ({
      cloudTab,
      billingTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2898 billing-web on session; C5 BE-17066 on staging; a workspace the account is not in'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const refused = billingTab.page.waitForResponse(
        (response) => response.status() === 403
      )
      await billingTab.goto(
        entryLink('checkout', { plan: PLAN, workspace: 'w-not-a-member' })
      )
      expect(await (await refused).text()).toContain('workspace_access_denied')
    })

    test('[SO5] Cloud ?workspace= while signed out opens that workspace after sign-in', async ({
      cloudTab,
      teamWorkspaceId
    }) => {
      test.fixme(
        true,
        'FE-2894 boot rules, FE-2903 Cloud lifecycle; C3 BE-17063 on staging'
      )
      await cloudTab.goto(`/?workspace=${teamWorkspaceId}`)
      await expect(cloudTab.page).toHaveURL(/\/login/)
      await expect(cloudTab.page).toHaveURL(new RegExp(teamWorkspaceId))
    })

    test('[SO6] a malformed link while signed out shows the entry error, not sign-in', async ({
      billingTab
    }) => {
      test.fixme(true, 'FE-2898 billing-web on session')
      await billingTab.page.goto(billingTab.url('/v1/pricing?product=nope'))
      await expect(
        billingTab.page.getByText("We couldn't open that billing page")
      ).toBeVisible()
    })
  }
)
