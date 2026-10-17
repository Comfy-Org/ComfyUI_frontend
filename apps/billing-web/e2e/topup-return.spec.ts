import { expect, test } from './fixtures/test'

const RETURN_PATH = '/return/topup'

test('opens signed out and stays on the return page', async ({
  page,
  cloud
}) => {
  await page.goto(`${RETURN_PATH}?session_id=cs_test_1`)

  await expect(
    page.getByRole('heading', { name: 'Return to ComfyUI' })
  ).toBeVisible()
  await expect(page.getByText('You can close this tab now.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${RETURN_PATH}\\?`))
  expect(
    cloud.requests.some((request) => request.path.startsWith('/billing/'))
  ).toBe(false)
})
