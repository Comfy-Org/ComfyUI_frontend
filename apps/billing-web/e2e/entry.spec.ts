import { expect, test } from './fixtures/test'

const BAD_LINKS = [
  {
    link: 'an unknown product',
    path: '/v1/subscription?product=nope&return_to=comfyui_workspace',
    reason: "That link doesn't say which product sent you here."
  },
  {
    link: 'a return target outside the registry',
    path: '/v1/subscription?product=comfyui&return_to=elsewhere',
    reason: "That link doesn't name a place we can send you back to."
  },
  {
    link: 'an intent that does not exist',
    path: '/v1/refunds?product=comfyui&return_to=comfyui_workspace',
    reason: "That link asks for a billing page that doesn't exist."
  }
]

for (const { link, path, reason } of BAD_LINKS) {
  test(`explains ${link} instead of redirecting`, async ({ page }) => {
    await page.goto(path)

    await expect(
      page.getByRole('heading', { name: "We couldn't open that billing page" })
    ).toBeVisible()
    await expect(page.getByText(reason)).toBeVisible()
    // Explaining the failure is only half of not redirecting: the misdirected
    // link has to stay legible. These visitors are signed out, so the guard
    // sends them to sign-in and carries the link in `returnTo`; a signed-in one
    // stays put. Either way the URL still names the link that failed, and a
    // bounce to another billing surface would lose it.
    const landed = new URL(page.url())
    const shown =
      landed.pathname === '/sign-in'
        ? landed.searchParams.get('returnTo')
        : landed.pathname + landed.search
    expect(shown).toBe(path)
  })
}
