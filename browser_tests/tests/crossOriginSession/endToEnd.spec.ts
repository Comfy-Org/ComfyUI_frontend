import { expect } from '@playwright/test'

import {
  crossOriginSessionFixture as test,
  sessionEndpoint,
  signInOnCloud
} from '@e2e/fixtures/crossOriginSessionFixture'
import { SessionTab } from '@e2e/fixtures/helpers/SessionTab'

test.describe(
  'Cross-origin session, section 17 end to end',
  { tag: ['@session', '@flag-on'] },
  () => {
    test('[E2E-01] sign in on Cloud, arrive signed in on the website with zero Firebase calls there', async ({
      cloudTab,
      websiteTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2896 website header, FE-2894 boot rules; C3 BE-17063 and C11 BE-17136 on testcloud'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const read = websiteTab.waitForResponse('GET', sessionEndpoint(cloudTab))
      await websiteTab.goto('/')
      expect((await read).status()).toBe(200)
      websiteTab.firebaseCalls.expectNone(
        'Firebase Auth calls from the website'
      )
    })

    test('[E2E-02] sign in on the website, arrive signed in on Cloud with zero Firebase calls there', async ({
      cloudTab,
      websiteTab
    }) => {
      test.fixme(
        true,
        'FE-2897 create on sign-in, FE-2903 Cloud lifecycle; C1 BE-17061 and C3 BE-17063 on testcloud'
      )
      await websiteTab.goto('/')
      const read = cloudTab.waitForResponse('GET', sessionEndpoint(cloudTab))
      await cloudTab.goto('/')
      expect((await read).status()).toBe(200)
      cloudTab.firebaseCalls.expectNone('Firebase Auth calls from Cloud')
    })

    test('[E2E-03] two tabs stay in two different workspaces', async ({
      context,
      cloudTab,
      sessionAccount,
      teamWorkspaceId
    }) => {
      test.fixme(true, 'FE-2904 workspace header; C5 BE-17066 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      const teamTab = new SessionTab(await context.newPage(), cloudTab.origin, {
        workspace: teamWorkspaceId
      })
      const [personal, team] = await Promise.all([
        cloudTab.nextWorkspaceId(cloudTab.origin),
        teamTab.nextWorkspaceId(cloudTab.origin),
        cloudTab.goto('/'),
        teamTab.goto('/')
      ])
      expect(team).toBe(teamWorkspaceId)
      expect(personal).not.toBe(teamWorkspaceId)
    })

    test('[E2E-04] team-workspace media loads from that workspace', async ({
      cloudTab,
      sessionAccount,
      teamWorkspaceId
    }) => {
      test.fixme(true, 'FE-2905 media workspace_id; C7 BE-17068 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      const media = cloudTab.page.waitForResponse(
        (response) =>
          new URL(response.url()).searchParams.get('workspace_id') ===
          teamWorkspaceId
      )
      await cloudTab.goto(`/?workspace=${teamWorkspaceId}`)
      expect((await media).ok()).toBe(true)
    })

    test('[E2E-05] sign out on one site, the other site signs out and its socket closes', async ({
      cloudTab,
      websiteTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2897 lifecycle, FE-2903 Cloud lifecycle, FE-2905 socket; C6 BE-17067 on testcloud'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const socket = await cloudTab.sockets.waitForSocket((url) =>
        url.pathname.endsWith('/ws')
      )
      await websiteTab.goto('/')
      const signOut = websiteTab.waitForResponse(
        'DELETE',
        sessionEndpoint(cloudTab)
      )
      expect((await signOut).ok()).toBe(true)
      await cloudTab.sockets.waitForClose(socket)
      await expect(cloudTab.page).toHaveURL(/\/login/)
    })

    test('[E2E-06] a user removed from a workspace is refused on the next request and the UI falls back', async ({
      cloudTab,
      sessionAccount,
      teamWorkspaceId
    }) => {
      test.fixme(true, 'FE-2904 403 handling; C5 BE-17066 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      await cloudTab.goto(`/?workspace=${teamWorkspaceId}`)
      const refused = cloudTab.page.waitForResponse(
        (response) =>
          response.url().startsWith(`${cloudTab.origin}/api/`) &&
          response.status() === 403
      )
      expect(await (await refused).text()).toContain('workspace_access_denied')
      expect(await cloudTab.nextWorkspaceId(cloudTab.origin)).not.toBe(
        teamWorkspaceId
      )
    })

    test("[E2E-07] sign out of all devices ends every site's session", async ({
      cloudTab,
      websiteTab,
      sessionAccount
    }) => {
      test.fixme(true, 'FE-2897 lifecycle; C2 BE-17064 revoke-all on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      const revokeAll = cloudTab.waitForResponse(
        'POST',
        `${cloudTab.origin}/api/auth/sessions/revoke-all`
      )
      expect((await revokeAll).ok()).toBe(true)
      const read = websiteTab.waitForResponse('GET', sessionEndpoint(cloudTab))
      await websiteTab.goto('/')
      expect(await (await read).text()).toContain('session_revoked')
    })
  }
)

test.describe(
  'Cross-origin session, section 17 end to end, flag off',
  { tag: ['@session', '@flag-off'] },
  () => {
    test('[E2E-08] flag off, every app behaves exactly as today', async ({
      cloudTab,
      websiteTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2891 flag reader (#18708) and the apps reading it (FE-2894, FE-2903); HARNESS-01 covers the baseline until then'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      await websiteTab.goto('/')
      expect(cloudTab.firebaseCalls.calls).not.toHaveLength(0)
      websiteTab.sessionCalls.expectNone('Session calls from the website')
    })

    test('[E2E-09] an already signed-in user crosses each rollout step without being signed out', async ({
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2903 Cloud lifecycle, FE-2907 rollout steps; C1 BE-17061, C3 BE-17063 and BE-17135 on testcloud'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const read = cloudTab.waitForResponse('GET', sessionEndpoint(cloudTab))
      await cloudTab.page.reload()
      expect((await read).status()).toBe(200)
      await expect(cloudTab.page).not.toHaveURL(/\/login/)
    })
  }
)
