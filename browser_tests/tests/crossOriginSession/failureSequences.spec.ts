import { expect } from '@playwright/test'

import {
  credentialedFetch,
  crossOriginSessionFixture as test,
  openPreviewPage,
  sessionEndpoint,
  signInOnCloud
} from '@e2e/fixtures/crossOriginSessionFixture'
import { SessionTab } from '@e2e/fixtures/helpers/SessionTab'

// Ids follow the TDD's failure-sequence table. FS-03, FS-04, FS-05, FS-16 and
// FS-17 are backend races and load cases a browser cannot observe.
test.describe(
  'Cross-origin session, failure sequences',
  { tag: ['@session', '@flag-on'] },
  () => {
    test('[FS-01] after sign out, a site with a remembered Firebase login on the old build does not silently restore', async ({
      cloudTab,
      websiteTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2894 boot rules; C1 BE-17061 revoked-cookie rule on testcloud'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const signOut = cloudTab.waitForResponse(
        'DELETE',
        sessionEndpoint(cloudTab)
      )
      expect((await signOut).ok()).toBe(true)
      const read = websiteTab.waitForResponse('GET', sessionEndpoint(cloudTab))
      await websiteTab.goto('/')
      expect(await (await read).text()).toContain('session_revoked')
      expect(websiteTab.sessionCalls.calls).not.toContainEqual(
        expect.stringMatching(/^POST /)
      )
    })

    test("[FS-02] signing out while an old-build tab refreshes its login refuses that tab's create call", async ({
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(true, 'FE-2903 Cloud lifecycle; C1 BE-17061 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      const signOut = cloudTab.waitForResponse(
        'DELETE',
        sessionEndpoint(cloudTab)
      )
      expect((await signOut).ok()).toBe(true)
      const create = cloudTab.waitForResponse('POST', sessionEndpoint(cloudTab))
      expect((await create).ok()).toBe(false)
    })

    test('[FS-06] two sites creating sessions with out-of-order responses end on one identity, and the losing site recovers on its next write', async ({
      cloudTab,
      websiteTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2897 lifecycle, FE-2903 Cloud lifecycle, FE-2898 billing-web; C1 BE-17061 on testcloud'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const [cloudRead, websiteRead] = await Promise.all([
        cloudTab.waitForResponse('GET', sessionEndpoint(cloudTab)),
        websiteTab.waitForResponse('GET', sessionEndpoint(cloudTab)),
        cloudTab.page.reload(),
        websiteTab.goto('/')
      ])
      expect((await websiteRead.json()).user).toEqual(
        (await cloudRead.json()).user
      )
    })

    test('[FS-07] a same-origin session read with no Origin header works', async ({
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(true, 'FE-2892 web session client; C3 BE-17063 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      const read = cloudTab.waitForResponse('GET', sessionEndpoint(cloudTab))
      await cloudTab.page.reload()
      const response = await read
      expect(await response.request().headerValue('origin')).toBeNull()
      expect(response.status()).toBe(200)
    })

    test('[FS-08] an untrusted PR preview page gets nothing readable from an authenticated GET with the cookie', async ({
      context,
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(true, 'C0 BE-17071 and C5 BE-17066 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      const preview = await openPreviewPage(context)
      expect(
        await credentialedFetch(
          preview,
          `${cloudTab.origin}/api/workspaces/current`
        )
      ).toBe('unreadable')
    })

    test('[FS-09] a link from another site opens a short link or the OAuth consent page', async ({
      cloudTab,
      websiteTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'C5 BE-17066 link-click exception on testcloud; target a real short link and the consent page'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      await websiteTab.goto('/')
      await websiteTab.page.evaluate((url) => {
        location.href = url
      }, cloudTab.url('/'))
      await websiteTab.page.waitForURL(`${cloudTab.origin}/**`)
      await expect(websiteTab.page).not.toHaveURL(/\/login/)
    })

    test("[FS-10] with Alice's cookie and Bob's Authorization header, the header credential is used and an invalid one fails", async ({
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2895 authorize(); C5 BE-17066 on testcloud; a second test account for the valid-header half'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const status = await cloudTab.page.evaluate(async (url) => {
        const response = await fetch(url, {
          headers: { Authorization: 'Bearer not-a-token' }
        })
        return response.status
      }, `${cloudTab.origin}/api/workspaces/current`)
      expect(status).toBe(401)
    })

    test('[FS-11] a revoked new cookie with a valid old Firebase cookie is refused', async ({
      context,
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(true, 'C1 BE-17061 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      const legacyCookies = (await context.cookies(cloudTab.origin)).filter(
        (cookie) => !cookie.name.startsWith('__Host-')
      )
      const signOut = cloudTab.waitForResponse(
        'DELETE',
        sessionEndpoint(cloudTab)
      )
      expect((await signOut).ok()).toBe(true)
      await context.addCookies(legacyCookies)
      expect(
        await credentialedFetch(
          cloudTab,
          `${cloudTab.origin}/api/workspaces/current`
        )
      ).toMatch(/^401 /)
    })

    test('[FS-12] after sign out of all devices, a tab with a remembered Firebase login cannot create a session', async ({
      cloudTab,
      websiteTab,
      sessionAccount
    }) => {
      test.fixme(true, 'FE-2897 lifecycle; C2 BE-17064 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      const revokeAll = cloudTab.waitForResponse(
        'POST',
        `${cloudTab.origin}/api/auth/sessions/revoke-all`
      )
      expect((await revokeAll).ok()).toBe(true)
      const create = websiteTab.waitForResponse(
        'POST',
        sessionEndpoint(cloudTab)
      )
      await websiteTab.goto('/')
      expect((await create).ok()).toBe(false)
    })

    test('[FS-13] an account change during CSRF recovery abandons the write', async ({
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2895 authorize(), FE-2904 API client; C5 BE-17066 on testcloud; a second test account to switch to'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      await cloudTab.page.route(
        `${cloudTab.origin}/api/**`,
        (route) =>
          route.request().method() === 'GET'
            ? route.fallback()
            : route.fulfill({
                status: 403,
                json: { error: { type: 'csrf_invalid' } }
              }),
        { times: 1 }
      )
      const reread = cloudTab.waitForResponse('GET', sessionEndpoint(cloudTab))
      expect((await reread).ok()).toBe(true)
    })

    test('[FS-14] losing workspace access during a write returns 403 with no replay in the personal workspace', async ({
      cloudTab,
      sessionAccount,
      teamWorkspaceId
    }) => {
      test.fixme(true, 'FE-2904 API client; C5 BE-17066 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      await cloudTab.goto(`/?workspace=${teamWorkspaceId}`)
      const refused = cloudTab.page.waitForResponse(
        (response) => response.status() === 403
      )
      expect(await (await refused).text()).toContain('workspace_access_denied')
      expect(cloudTab.sessionCalls.calls).not.toContainEqual(
        expect.stringMatching(/^POST /)
      )
    })

    test("[FS-15] removing a member closes that member's open socket", async ({
      cloudTab,
      sessionAccount,
      teamWorkspaceId
    }) => {
      test.fixme(true, 'FE-2905 socket on session; C6 BE-17067 on testcloud')
      await signInOnCloud(cloudTab, sessionAccount)
      await cloudTab.goto(`/?workspace=${teamWorkspaceId}`)
      const socket = await cloudTab.sockets.waitForSocket(
        (url) => url.searchParams.get('workspace_id') === teamWorkspaceId
      )
      await cloudTab.sockets.waitForClose(socket)
      expect(socket.isClosed()).toBe(true)
    })

    test('[FS-18] a PR preview page posting to the custom-node proxy with the cookie is refused', async ({
      context,
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'C0 BE-17071 and C5 BE-17066 on testcloud; swap in the custom-node proxy route once C5 names it'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      const preview = await openPreviewPage(context)
      expect(
        await credentialedFetch(preview, sessionEndpoint(cloudTab), 'POST')
      ).toBe('unreadable')
    })

    test('[FS-19] browser restart, restored tabs, cleared storage and a lapsed session behave the same (Chromium)', async ({
      context,
      cloudTab,
      sessionAccount
    }) => {
      test.fixme(
        true,
        'FE-2894 boot rules, FE-2897 heartbeat; C1 BE-17061 on testcloud; other browsers and Desktop stay manual'
      )
      await signInOnCloud(cloudTab, sessionAccount)
      await cloudTab.page.evaluate(() => localStorage.clear())
      const restored = new SessionTab(await context.newPage(), cloudTab.origin)
      const read = restored.waitForResponse('GET', sessionEndpoint(cloudTab))
      await restored.goto('/')
      expect((await read).status()).toBe(200)
      await expect(restored.page).not.toHaveURL(/\/login/)
    })
  }
)
