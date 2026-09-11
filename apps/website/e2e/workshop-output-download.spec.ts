import { expect } from '@playwright/test'

import { test } from './fixtures/outputDownload'

test('download reserves a detached tab before a delayed fetch fails @smoke', async ({
  page,
  context,
  outputDownload
}) => {
  const opened = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Download output' }).click()
  const popup = await opened
  await expect(popup).toHaveURL('about:blank')
  await expect
    .poll(() => popup.evaluate(() => window.opener === null))
    .toBe(true)
  outputDownload.release()
  await expect(popup).toHaveURL(outputDownload.url)
  await expect(popup.getByText('Provider output')).toBeVisible()
  await expect
    .poll(() => popup.evaluate(() => window.opener === null))
    .toBe(true)
  await expect(
    page.getByRole('button', { name: 'Download output' })
  ).toBeVisible()
})
