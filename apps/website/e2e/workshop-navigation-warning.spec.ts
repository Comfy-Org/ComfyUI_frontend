import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  MODEL_NAVIGATION_PATH as MODEL_PATH,
  test
} from './fixtures/modelsAccount'

test.beforeEach(async ({ page, modelsAccount }) => {
  await page.route('**/v2/models/bfl/flux-2-pro', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-generation',
        status: 'Ready',
        result: { sample: 'https://media.comfy.org/tests/result.webp' }
      })
    })
  )
  await page.goto(MODEL_PATH)
  await page.getByRole('link', { name: 'Sign in to run', exact: true }).click()
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(modelsAccount.email)
  await page
    .getByLabel('Password', { exact: true })
    .fill(modelsAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
  await page.getByTestId('model-back').click()
  await expect(page).toHaveURL(/\/models(?:\?.*)?$/)
  await page
    .getByRole('link', { name: /FLUX 2 Pro/ })
    .first()
    .click()
  await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
  await page.getByTestId('model-back').click()
  await expect(page).toHaveURL(/\/models(?:\?.*)?$/)
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'succeeded'
  )
})

test('warns once before leaving an undownloaded generated output with a link', async ({
  page
}) => {
  const dialogs: string[] = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.type())
    await dialog.dismiss()
  })

  const timeOrigin = await page.evaluate(() => performance.timeOrigin)
  await page.getByTestId('model-back').click()
  await expect(page.getByTestId('run-leave-dialog')).toBeVisible()
  await page.getByTestId('run-leave-stay').click()
  await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'succeeded'
  )
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
  expect(dialogs).toEqual([])

  await page.getByTestId('model-back').click()
  await page.getByTestId('run-leave-confirm').click()
  await expect(page).toHaveURL(/\/models(?:\?.*)?$/)
  expect(dialogs).toEqual([])
})

for (const { name, attempt } of [
  {
    name: 'Back',
    attempt: (page: Page) => page.evaluate(() => history.back())
  },
  {
    name: 'Forward',
    attempt: (page: Page) => page.evaluate(() => history.forward())
  },
  {
    name: 'refresh',
    attempt: (page: Page) => page.evaluate(() => location.reload())
  },
  {
    name: 'tab close',
    attempt: (page: Page) => page.close({ runBeforeUnload: true })
  }
]) {
  test(`keeps the page and generated output when ${name} is cancelled`, async ({
    page
  }) => {
    const dialogs: string[] = []
    const dismissed = Promise.withResolvers<void>()
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.type())
      await dialog.dismiss()
      dismissed.resolve()
    })

    const timeOrigin = await page.evaluate(() => performance.timeOrigin)
    await attempt(page)
    await dismissed.promise
    await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
    await expect(page.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'succeeded'
    )
    await expect(page.getByTestId('run-leave-dialog')).toBeHidden()

    const download = page.waitForEvent('download')
    await page.getByTestId('output-download').click()
    expect(await (await download).failure()).toBeNull()
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
    expect(dialogs).toEqual(['beforeunload'])
  })
}
