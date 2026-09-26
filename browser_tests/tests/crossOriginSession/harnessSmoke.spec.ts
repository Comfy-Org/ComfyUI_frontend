import { expect } from '@playwright/test'

import {
  crossOriginSessionFixture as test,
  SERVED_LOCALLY_HEADER,
  signInOnCloud
} from '@e2e/fixtures/crossOriginSessionFixture'

test.describe(
  'Cross-origin session harness',
  { tag: ['@session', '@flag-off'] },
  () => {
    test('[HARNESS-01] serves the website on its comfy.org name and records Cloud Firebase sign-in', async ({
      sessionEnv,
      websiteTab,
      cloudTab,
      sessionAccount
    }) => {
      const website = await websiteTab.goto('/')
      expect(website?.headers()[SERVED_LOCALLY_HEADER]).toBe(
        sessionEnv.SESSION_E2E_WEBSITE_UPSTREAM
      )
      await expect(websiteTab.page).toHaveURL(`${websiteTab.origin}/`)

      const cloudFeatures = `${cloudTab.origin}/api/features`
      const [crossOriginRead] = await Promise.all([
        websiteTab.page.waitForRequest(cloudFeatures),
        websiteTab.page.evaluate(
          (url) =>
            fetch(url).then(
              () => undefined,
              () => undefined
            ),
          cloudFeatures
        )
      ])
      expect(await crossOriginRead.headerValue('origin')).toBe(
        websiteTab.origin
      )

      await signInOnCloud(cloudTab, sessionAccount)
      expect(cloudTab.firebaseCalls.calls).not.toHaveLength(0)
    })
  }
)
