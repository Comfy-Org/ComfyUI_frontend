import { expect } from '@playwright/test'

import type { SessionTab } from '@e2e/fixtures/helpers/SessionTab'
import {
  blockedBy,
  crossOriginSessionFixture as test,
  expectActiveWorkspace,
  expectOffWebSession,
  expectOnWebSession,
  expectStepsWritten,
  signInOnCloud,
  waitForCloudApp
} from '@e2e/fixtures/crossOriginSessionFixture'

const WORKSPACE_LINK = /[?&]workspace=/
const FLAG_ON = 'unified_web_session:true'
const FLAG_OFF = 'unified_web_session:false'

async function reloadAndReadScope(tab: SessionTab) {
  tab.reset()
  await tab.page.reload()
  const request = await tab.nextSessionRequest(tab.origin)
  const socket = new URL((await tab.cloudSocket()).url())
  return { request, socket }
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

      const inTeam = await reloadAndReadScope(teamTab)
      expect(inTeam.request).toEqual({
        workspaceId: team.id,
        authorization: null
      })
      expect(inTeam.socket.searchParams.get('workspace_id')).toBe(team.id)
      expect(inTeam.socket.searchParams.has('token')).toBe(false)

      const inPersonal = await reloadAndReadScope(cloudTab)
      expect(inPersonal.request).toEqual({
        workspaceId: null,
        authorization: null
      })
      expect(inPersonal.socket.searchParams.has('workspace_id')).toBe(false)
      expect(inPersonal.socket.searchParams.has('token')).toBe(false)

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

    test(
      '[E2E-09] an already signed-in user crosses each rollout step without being signed out',
      {
        annotation: {
          type: 'pending-step',
          description:
            'The website step waits for PR 2 (BE-17276: probe on testcloud)'
        }
      },
      async ({ sessionAccount, newCloudTab }) => {
        const cloud = await newCloudTab({ unifiedWebSession: false })

        await signInOnCloud(cloud, sessionAccount, { unifiedWebSession: false })
        await waitForCloudApp(cloud)
        await expectOffWebSession(cloud)

        cloud.reset()
        await cloud.goto('/', { ff: FLAG_ON })
        await waitForCloudApp(cloud)
        await expectOnWebSession(cloud)
        expect(
          cloud.sessionCalls.calls.filter(
            (call) => call === `POST ${cloud.origin}/api/auth/session`
          ).length,
          'Turning the flag on creates at most one session'
        ).toBeLessThanOrEqual(1)

        cloud.reset()
        await cloud.goto('/', { ff: FLAG_OFF })
        await waitForCloudApp(cloud)
        await expectOffWebSession(cloud)
      }
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
