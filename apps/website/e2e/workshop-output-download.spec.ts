import { expect } from '@playwright/test'

import { test } from './fixtures/outputDownload'

test('slow download headers open the output only after the header timeout @smoke', async ({
  page,
  context,
  outputDownload
}) => {
  await page.clock.install()
  const opened = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Download output' }).click()
  expect(context.pages()).toHaveLength(1)
  await page.clock.runFor(3_999)
  expect(context.pages()).toHaveLength(1)
  await page.clock.runFor(1)
  const popup = await opened
  await expect(popup).toHaveURL(outputDownload.url)
  await expect(popup.getByText('Provider output')).toBeVisible()
  await expect
    .poll(() => popup.evaluate(() => window.opener === null))
    .toBe(true)
  await expect(
    page.getByRole('button', { name: 'Download output' })
  ).toBeVisible()
})

test('successful downloads keep the Models page in its original tab @smoke', async ({
  page,
  context,
  outputDownload
}) => {
  const opened: string[] = []
  context.on('page', (popup) => opened.push(popup.url()))
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download output' }).click()
  expect(context.pages()).toHaveLength(1)
  outputDownload.release(200)
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('render.png')
  expect(await download.failure()).toBeNull()
  expect(context.pages()).toHaveLength(1)
  expect(opened).toEqual([])
  await expect(
    page.getByRole('button', { name: 'Download output' })
  ).toBeVisible()
})
