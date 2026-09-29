import { zErrorResponse } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { Response } from '@playwright/test'

import {
  blockedBy,
  crossOriginSessionFixture as test,
  expectOnWebSession,
  expectStepsWritten,
  signInOnCloud,
  waitForCloudApp
} from '@e2e/fixtures/crossOriginSessionFixture'

function isSessionRead(response: Response): boolean {
  return (
    response.request().method() === 'GET' &&
    new URL(response.url()).pathname === '/api/auth/session'
  )
}

// Ids follow the TDD's failure-sequence table. FS-03, FS-04, FS-05, FS-16 and
// FS-17 are backend races and load cases a browser cannot observe.
test.describe(
  'Cross-origin session, failure sequences',
  { tag: ['@session', '@flag-on'] },
  () => {
    test.fixme(
      '[FS-01] after sign out, a site with a remembered Firebase login on the old build does not silently restore',
      blockedBy(
        'FE-2894 boot rules; C1 BE-17061 revoked-cookie rule on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      "[FS-02] signing out while an old-build tab refreshes its login refuses that tab's create call",
      blockedBy('FE-2903 Cloud lifecycle; C1 BE-17061 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-06] two sites creating sessions with out-of-order responses end on one identity, and the losing site recovers on its next write',
      blockedBy(
        'Covered by unit tests (webSessionIdentity lifecycle); a browser cannot order two responses. Deferred'
      ),
      expectStepsWritten
    )

    test('[FS-07] a same-origin session read with no Origin header works', async ({
      sessionAccount,
      sessionAdmin,
      cloudTab
    }) => {
      await signInOnCloud(cloudTab, sessionAccount, { unifiedWebSession: true })
      await waitForCloudApp(cloudTab)

      const read = cloudTab.page.waitForResponse(isSessionRead)
      await cloudTab.page.reload()
      const response = await read
      const request = response.request()

      expect(await request.headerValue('origin')).toBeNull()
      expect(await request.headerValue('sec-fetch-site')).toBe('same-origin')
      expect(response.status()).toBe(200)

      expect(
        await sessionAdmin.readSessionWithoutOrigin(),
        'A read with neither Origin nor Sec-Fetch-Site is refused'
      ).toEqual({ status: 403, code: 'origin_not_allowed' })
    })

    test.fixme(
      '[FS-08] an untrusted PR preview page gets nothing readable from an authenticated GET with the cookie',
      blockedBy('Confirm C0 BE-17071 is on testcloud before writing the steps'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-09] a link from another site opens a short link or the OAuth consent page',
      blockedBy(
        'A real short link and the OAuth client data for the consent page'
      ),
      expectStepsWritten
    )

    test.fixme(
      "[FS-10] with Alice's cookie and Bob's Authorization header, the header credential is used and an invalid one fails",
      blockedBy(
        'A second test account: a member account for the valid-header half'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[FS-11] a revoked new cookie with a valid old Firebase cookie is refused',
      blockedBy(
        'Backend clarification of what the old Firebase cookie is on testcloud'
      ),
      expectStepsWritten
    )

    test('[FS-12] after sign out of all devices, a tab with a remembered Firebase login cannot create a session', async ({
      sessionAccount,
      sessionAdmin,
      cloudTab
    }) => {
      await signInOnCloud(cloudTab, sessionAccount, { unifiedWebSession: true })
      await waitForCloudApp(cloudTab)
      await expectOnWebSession(cloudTab)

      expect(
        await sessionAdmin.revokeAll(),
        'Another device signs the account out everywhere'
      ).toBeGreaterThanOrEqual(1)

      cloudTab.reset()
      const read = cloudTab.page.waitForResponse(isSessionRead)
      await cloudTab.page.reload()
      const response = await read

      expect(response.status()).toBe(401)
      expect(zErrorResponse.parse(await response.json()).code).toBe(
        'session_revoked'
      )
      await expect(cloudTab.page).toHaveURL(/\/cloud\/login/)
      expect(
        cloudTab.sessionCalls.calls,
        'The remembered Firebase login creates no session'
      ).not.toContain(`POST ${cloudTab.origin}/api/auth/session`)
    })

    test.fixme(
      '[FS-13] an account change during CSRF recovery abandons the write',
      blockedBy(
        'Covered by unit tests (requestAuth, webSessionRequests); a browser cannot switch accounts mid-recovery. Deferred'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[FS-14] losing workspace access during a write returns 403 with no replay in the personal workspace',
      blockedBy('A member account to remove from the workspace mid-write'),
      expectStepsWritten
    )

    test.fixme(
      "[FS-15] removing a member closes that member's open socket",
      blockedBy('A member account to remove; C6 BE-17067 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-18] a PR preview page posting to the custom-node proxy with the cookie is refused',
      blockedBy(
        'The name of the custom-node proxy route; C0 BE-17071 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[FS-19] browser restart, restored tabs, cleared storage and a lapsed session behave the same (Chromium)',
      blockedBy(
        'A lapsed session cannot be forced from outside; other browsers and Desktop stay manual'
      ),
      expectStepsWritten
    )
  }
)
