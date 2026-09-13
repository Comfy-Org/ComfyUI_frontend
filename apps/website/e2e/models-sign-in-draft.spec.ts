import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

const path = '/models/byteplus--seedream-4-5--edit-images/'

for (const entry of ['playground', 'header']) {
  test(`selected reference bytes survive ${entry} sign-in and reach Router`, async ({
    page,
    modelsAccount
  }) => {
    await page.goto(path)
    const chooser = page.waitForEvent('filechooser')
    await page
      .getByText('Choose images or drop them here', { exact: true })
      .click()
    await (await chooser).setFiles('e2e/assets/placeholder-1x1.webp')
    const replacement = page.getByRole('button', {
      name: 'Replace placeholder-1x1.webp'
    })
    await expect(replacement).toBeVisible()
    await page
      .getByRole('textbox', { name: 'Prompt', exact: true })
      .fill('Keep the reference character, watercolor style')
    const signIn =
      entry === 'playground'
        ? page.getByRole('link', { name: 'Sign in to run', exact: true })
        : page.getByRole('link', { name: 'Sign in', exact: true })
    await signIn.click()
    await expect(page).toHaveURL(/\/login\/\?returnTo=/)
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(modelsAccount.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(modelsAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(replacement).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Prompt', exact: true })
    ).toHaveValue('Keep the reference character, watercolor style')
    const request = page.waitForRequest(
      '**/v2/models/byteplus/seedream-4-5-251128'
    )
    let calls = 0
    await page.route('**/v2/models/**', (route) => {
      if (++calls === 2)
        return route.fulfill({
          status: 503,
          headers: { 'X-Comfy-Error-Type': 'provider_error' },
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Temporary provider error' })
        })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images: [{ url: 'https://media.comfy.org/tests/result.webp' }]
        })
      })
    })
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    const first = await request
    expect(first.postDataJSON()).toMatchObject({
      prompt: 'Keep the reference character, watercolor style',
      image:
        'data:image/webp;base64,' +
        readFileSync('e2e/assets/placeholder-1x1.webp').toString('base64')
    })
    await expect(page.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'succeeded'
    )
    const changedBytes = readFileSync('public/hero/input.webp')
    const replaceChooser = page.waitForEvent('filechooser')
    await replacement.click()
    await (
      await replaceChooser
    ).setFiles({
      name: 'placeholder-1x1.webp',
      mimeType: 'image/webp',
      buffer: changedBytes
    })
    const changedRequest = page.waitForRequest(
      '**/v2/models/byteplus/seedream-4-5-251128'
    )
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    const changed = await changedRequest
    expect(changed.postDataJSON()).toMatchObject({
      image: 'data:image/webp;base64,' + changedBytes.toString('base64')
    })
    expect(changed.headers()['idempotency-key']).not.toBe(
      first.headers()['idempotency-key']
    )
    await expect(page.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'failed'
    )
    const retryRequest = page.waitForRequest(
      '**/v2/models/byteplus/seedream-4-5-251128'
    )
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    const retried = await retryRequest
    expect(retried.postDataJSON()).toEqual(changed.postDataJSON())
    expect(retried.headers()['idempotency-key']).toBe(
      changed.headers()['idempotency-key']
    )
    await expect(page.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'succeeded'
    )
  })
}

test('unavailable draft storage does not trap sign-in and reports missing files on return', async ({
  page
}) => {
  await page.addInitScript(() => {
    window.indexedDB.open = () => {
      throw new DOMException('Storage disabled', 'SecurityError')
    }
  })
  await page.goto(path)
  const chooser = page.waitForEvent('filechooser')
  await page
    .getByText('Choose images or drop them here', { exact: true })
    .click()
  await (await chooser).setFiles('e2e/assets/placeholder-1x1.webp')
  await page.getByRole('link', { name: 'Sign in to run', exact: true }).click()
  await expect(page).toHaveURL(/\/login\/\?returnTo=/)
  await page.goto(path)
  await expect(
    page.getByText(
      'Some saved inputs could not be restored. Check your inputs and select your files again.'
    )
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Replace placeholder-1x1.webp' })
  ).toHaveCount(0)
})
