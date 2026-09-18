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
    // The name of this test is the assertion: a bad link explains itself where
    // it landed, and bouncing the customer elsewhere would hide the misdirection.
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(path)
  })
}
