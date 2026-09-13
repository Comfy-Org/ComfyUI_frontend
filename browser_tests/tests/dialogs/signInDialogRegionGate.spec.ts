import { expect } from '@playwright/test'

import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { localSignedOutFixture as test } from '@e2e/fixtures/localSignedOutFixture'

/**
 * The China region gate on the local dialog's sign-up form.
 * `signInDialogAuth.spec.ts` covers email credentials against a US probe
 * result (`networkIsolationFixture`'s default); this overrides the same
 * `cdn-cgi/trace` route per-test to exercise the `blocked` branch.
 *
 * Google/GitHub popup mechanics (closed, blocked, a second popup cancelling
 * the first) stay at the unit level in `useAuthActions.test.ts`, which asserts
 * their classification and copy (`auth/popup-closed-by-user`,
 * `auth/popup-blocked`, `auth/cancelled-popup-request`) without the popup:
 * Firebase's popup resolver loads a real Google-hosted script and opens a
 * hidden iframe with a cross-window postMessage handshake before it ever calls
 * `window.open`, which `networkIsolationFixture` blocks with no seam to fake.
 */
test.describe('Sign In dialog — region gate', () => {
  test('replaces the sign-up form with the region notice inside China', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.route('https://cloud.comfy.org/cdn-cgi/trace', (route) =>
      route.fulfill({ contentType: 'text/plain', body: 'loc=CN\n' })
    )

    const dialog = new SignInDialog(page)
    await dialog.open()
    await dialog.signUpLink.click()

    await expect(
      page.getByText(
        'In accordance with local regulatory requirements, our services are temporarily unavailable to users located in China.'
      )
    ).toBeVisible()
    await expect(dialog.signUpEmailInput).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Sign up with Google' })
    ).toBeVisible()
  })
})
