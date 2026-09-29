import { expect } from '@playwright/test'

import {
  blockedBy,
  crossOriginSessionFixture as test,
  expectActiveWorkspace,
  expectOnWebSession,
  expectStepsWritten,
  submitEmailSignIn,
  waitForCloudApp
} from '@e2e/fixtures/crossOriginSessionFixture'

const PROBE_OFF =
  'BE-17276: web_session_probe is false on testcloud, so billing-web never takes the session path'

// Milestone 2 QA plan cases SS1-SS6 and SO1-SO6, restated for billing-web on
// the shared session.
test.describe(
  'Cross-origin session, billing-web handoff',
  { tag: ['@session', '@flag-on'] },
  () => {
    test.fixme(
      '[SS1] signed in on Cloud, Subscribe opens billing-web checkout with no sign-in form',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )

    test.fixme(
      '[SS2] signed in on both, Subscribe keeps the plan and workspace the app sent',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )

    test.fixme(
      "[SS3] different accounts on billing-web and Cloud end on the session's one identity with a notice",
      blockedBy('A member account: a second test account to switch to'),
      expectStepsWritten
    )

    test.fixme(
      '[SS4] signing out of Cloud signs billing-web out too',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )

    test.fixme(
      '[SS5] an expiring workspace token mid-checkout recovers with no sign-in prompt',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )

    test.fixme(
      '[SS6] a second entry link opens a second billing-web tab in its own workspace',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )

    test.fixme(
      '[SO1] signed out, a checkout link keeps every parameter through sign-in',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )

    test.fixme(
      '[SO2] signed out, subscription, payment-method and result links keep their parameters',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )

    test.fixme(
      '[SO3] an abandoned sign-in stays on sign-in with a way to retry',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )

    test.fixme(
      "[SO4] signing in as a non-member shows the can't-access copy and never personal data",
      blockedBy('A member account: a workspace the account is not in'),
      expectStepsWritten
    )

    test('[SO5] Cloud ?workspace= while signed out opens that workspace after sign-in', async ({
      sessionAccount,
      sessionAdmin,
      teamWorkspaceId,
      cloudTab
    }) => {
      const { team } = await sessionAdmin.workspaces(teamWorkspaceId)

      await cloudTab.goto(`/?workspace=${team.id}`)
      await expect(cloudTab.page).toHaveURL(/\/cloud\/login/)
      await submitEmailSignIn(cloudTab, sessionAccount, {
        unifiedWebSession: true
      })

      await waitForCloudApp(cloudTab)
      await expect(cloudTab.page).not.toHaveURL(/[?&]workspace=/)
      await expectActiveWorkspace(cloudTab, team.name)

      cloudTab.reset()
      await cloudTab.page.reload()
      const request = await cloudTab.nextSessionRequest(cloudTab.origin)
      expect(request.workspaceId).toBe(team.id)
      await expectOnWebSession(cloudTab)
    })

    test.fixme(
      '[SO6] a malformed link while signed out shows the entry error, not sign-in',
      blockedBy(PROBE_OFF),
      expectStepsWritten
    )
  }
)
