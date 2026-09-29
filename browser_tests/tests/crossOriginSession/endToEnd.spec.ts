import { expect } from '@playwright/test'

import type { SessionTab } from '@e2e/fixtures/helpers/SessionTab'
import {
  blockedBy,
  crossOriginSessionFixture as test,
  expectActiveWorkspace,
  expectOffWebSession,
  expectStepsWritten,
  expectWorkspaceScope,
  signInOnCloud,
  waitForCloudApp
} from '@e2e/fixtures/crossOriginSessionFixture'

const WORKSPACE_LINK = /[?&]workspace=/

async function reloadAndReadSocket(tab: SessionTab) {
  tab.reset()
  await tab.page.reload()
  return new URL((await tab.cloudSocket()).url())
}

test.describe(
  'Cross-origin session, section 17 end to end',
  { tag: ['@session', '@flag-on'] },
  () => {
    test.fixme(
      '[E2E-01] sign in on Cloud, arrive signed in on the website with zero Firebase calls there',
      blockedBy(
        'BE-17276: web_session_probe is false on testcloud, so the website never takes the session path'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-02] sign in on the website, arrive signed in on Cloud with zero Firebase calls there',
      blockedBy(
        'Product gap: the website sign-in creates no web session, and Cloud still needs its own Firebase login'
      ),
      expectStepsWritten
    )

    test('[E2E-03] two tabs stay in two different workspaces', async ({
      sessionAccount,
      sessionAdmin,
      teamWorkspaceId,
      cloudTab,
      newCloudTab
    }) => {
      const { personalId, team } =
        await sessionAdmin.workspaces(teamWorkspaceId)

      await signInOnCloud(cloudTab, sessionAccount, { unifiedWebSession: true })
      await cloudTab.goto(`/?workspace=${personalId}`)
      await expect(cloudTab.page).not.toHaveURL(WORKSPACE_LINK)
      await waitForCloudApp(cloudTab)

      const teamTab = await newCloudTab()
      await teamTab.goto(`/?workspace=${team.id}`)
      await expect(teamTab.page).not.toHaveURL(WORKSPACE_LINK)
      await waitForCloudApp(teamTab)
      await expectActiveWorkspace(teamTab, team.name)

      const teamSocket = await reloadAndReadSocket(teamTab)
      await expectWorkspaceScope(teamTab, team.id)
      expect(teamSocket.searchParams.get('workspace_id')).toBe(team.id)
      expect(teamSocket.searchParams.has('token')).toBe(false)

      const personalSocket = await reloadAndReadSocket(cloudTab)
      await expectWorkspaceScope(cloudTab, null)
      expect(personalSocket.searchParams.has('workspace_id')).toBe(false)
      expect(personalSocket.searchParams.has('token')).toBe(false)

      teamTab.tokenMints.expectNone('The team tab mints no workspace token')
      cloudTab.tokenMints.expectNone('The personal tab mints no token')
    })

    test.fixme(
      '[E2E-04] team-workspace media loads from that workspace',
      blockedBy('FE-2905 media workspace_id; C7 BE-17068 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-05] sign out on one site, the other site signs out and its socket closes',
      blockedBy(
        'BE-17276: web_session_probe is false on testcloud, so the second site never takes the session path'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-06] a user removed from a workspace is refused on the next request and the UI falls back',
      blockedBy('A member account: removing the owner account is not a test'),
      expectStepsWritten
    )

    test.fixme(
      "[E2E-07] sign out of all devices ends every site's session",
      blockedBy(
        'BE-17276: web_session_probe is false on testcloud, so the other sites never take the session path'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-09] an already signed-in user crosses each rollout step without being signed out',
      {
        annotation: {
          type: 'blocked-by',
          description:
            'Needs rollout-step control on testcloud (FE-2907), or a dev-build Cloud upstream where the ff: localStorage override applies before start()'
        }
      },
      expectStepsWritten
    )
  }
)

test.describe(
  'Cross-origin session, section 17 end to end, flag off',
  { tag: ['@session', '@flag-off'] },
  () => {
    test('[E2E-08] flag off, every app behaves exactly as today', async ({
      sessionAccount,
      cloudTab,
      websiteTab,
      billingTab
    }) => {
      await signInOnCloud(cloudTab, sessionAccount, {
        unifiedWebSession: false
      })
      await waitForCloudApp(cloudTab)
      await expectOffWebSession(cloudTab)

      const featureReadsWithClient: string[] = []
      websiteTab.page.on('request', (request) => {
        if (
          new URL(request.url()).pathname === '/api/features' &&
          'x-comfy-client' in request.headers()
        ) {
          featureReadsWithClient.push(request.url())
        }
      })
      await websiteTab.goto('/')
      await expect(
        websiteTab.page.getByRole('link', { name: 'Sign in', exact: true })
      ).toBeVisible()
      websiteTab.sessionCalls.expectNone('The website reads no web session')
      expect(
        featureReadsWithClient,
        'The website sends no credentialed flag read'
      ).toEqual([])

      await billingTab.goto('/')
      await expect(
        billingTab.page.getByRole('heading', {
          name: 'Sign in to your account'
        })
      ).toBeVisible()
      billingTab.sessionCalls.expectNone('billing-web reads no web session')
    })
  }
)
