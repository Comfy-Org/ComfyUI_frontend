import { readFileSync } from 'node:fs'

import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

const path = '/models/byteplus--seedream-4-5--edit-images/'

for (const { entry, randomUUID, failRead } of [
  { entry: 'playground', randomUUID: true, failRead: false },
  { entry: 'header', randomUUID: true, failRead: false },
  { entry: 'header', randomUUID: false, failRead: false },
  { entry: 'header', randomUUID: true, failRead: true }
]) {
  test(`selected reference bytes survive ${entry} sign-in and reach Router${randomUUID ? '' : ' without crypto.randomUUID'}${failRead ? ' after a transient read failure' : ''}`, async ({
    page,
    modelsAccount
  }) => {
    if (!randomUUID)
      await page.addInitScript(() => {
        Object.defineProperty(crypto, 'randomUUID', { value: undefined })
      })
    if (failRead)
      await page.addInitScript(() => {
        const get = IDBObjectStore.prototype.get
        IDBObjectStore.prototype.get = function (query) {
          if (
            this.transaction.db.name === 'comfy-workshop-drafts' &&
            !sessionStorage.getItem('test:draft-read-failed')
          ) {
            sessionStorage.setItem('test:draft-read-failed', '1')
            throw new DOMException('Read interrupted', 'UnknownError')
          }
          return get.call(this, query)
        }
      })
    await page.goto(path)
    const chooser = page.waitForEvent('filechooser')
    await page
      .getByRole('button', { name: /^Replace seedream-4-5-input-/ })
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
    if (failRead) {
      await expect(
        page.getByText(
          'We could not restore all of your saved inputs. Check the form and pick your files again.'
        )
      ).toBeVisible()
      await page.reload()
    }
    await expect(replacement).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Prompt', exact: true })
    ).toHaveValue('Keep the reference character, watercolor style')
    const request = page.waitForRequest(
      '**/v2/models/byteplus/seedream-4-5-251128/requests'
    )
    const requestId = '6f1a1a6e-6a53-4a5f-9d3a-2b3b0a1f9c21'
    let submits = 0
    await page.route('**/v2/models/**', (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            images: [{ url: 'https://media.comfy.org/tests/result.webp' }]
          })
        })
      if (++submits === 2)
        return route.fulfill({
          status: 503,
          headers: { 'X-Comfy-Error-Type': 'provider_error' },
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Temporary provider error' })
        })
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ request_id: requestId, status: 'IN_QUEUE' })
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
      '**/v2/models/byteplus/seedream-4-5-251128/requests'
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
      '**/v2/models/byteplus/seedream-4-5-251128/requests'
    )
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    const retried = await retryRequest
    expect(retried.postDataJSON()).toEqual(changed.postDataJSON())
    expect(retried.headers()['idempotency-key']).not.toBe(
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
  await page.getByText(/^Select or drop /).click()
  await (await chooser).setFiles('e2e/assets/placeholder-1x1.webp')
  await page.getByRole('link', { name: 'Sign in to run', exact: true }).click()
  await expect(page).toHaveURL(/\/login\/\?returnTo=/)
  await page.goto(path)
  await expect(
    page.getByText(
      'We could not restore all of your saved inputs. Check the form and pick your files again.'
    )
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Replace placeholder-1x1.webp' })
  ).toHaveCount(0)
})

test('the workspace list opens beside the account menu, not over it', async ({
  page,
  modelsAccount
}) => {
  await page.route('**/api/workspaces', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspaces: [
          {
            id: 'ws-personal',
            name: 'Personal Workspace',
            role: 'owner',
            type: 'personal',
            created_at: '2026-01-01T00:00:00Z',
            joined_at: '2026-01-01T00:00:00Z'
          },
          {
            id: 'ws-team',
            name: 'Design Team',
            role: 'member',
            type: 'team',
            subscription_tier: 'PRO',
            created_at: '2026-02-01T00:00:00Z',
            joined_at: '2026-02-01T00:00:00Z'
          }
        ]
      })
    })
  )
  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(modelsAccount.email)
  await page
    .getByLabel('Password', { exact: true })
    .fill(modelsAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')

  await page.locator('[data-testid="header-account"]:visible').click()
  const menu = page.getByTestId('header-account-menu')
  await expect(menu).toBeVisible()
  await page.getByTestId('account-workspace').click()
  const workspaces = page.getByTestId('account-workspaces')
  await expect(workspaces).toBeVisible()

  await expect
    .poll(async () => {
      const [menuBox, listBox] = await Promise.all([
        menu.boundingBox(),
        workspaces.boundingBox()
      ])
      if (!menuBox || !listBox) return false
      return listBox.x + listBox.width <= menuBox.x
    })
    .toBe(true)
})

test.describe('Narrow account menu', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('stays inside the viewport after sign-in', async ({
    page,
    modelsAccount
  }) => {
    await page.goto('/login/')
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(modelsAccount.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(modelsAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    await page
      .getByTestId('mobile-nav-cta')
      .getByTestId('header-account')
      .click()
    const menu = page.getByTestId('header-account-menu')
    await expect(menu).toBeVisible()
    await expect
      .poll(async () => {
        const [box, viewport] = await Promise.all([
          menu.boundingBox(),
          page.evaluate(() => window.innerWidth)
        ])
        if (!box) return false
        return box.x >= 0 && box.x + box.width <= viewport
      })
      .toBe(true)
  })

  test('names the workspace the credits belong to, apart from the person', async ({
    page,
    modelsAccount
  }) => {
    await page.goto('/login/')
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(modelsAccount.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(modelsAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    await page
      .getByTestId('mobile-nav-cta')
      .getByTestId('header-account')
      .click()

    const workspace = page.getByTestId('account-workspace-current')
    await expect(workspace).toContainText('Personal')
    const identity = page.getByTestId('account-identity')
    await expect(identity).toContainText(modelsAccount.email)
    await expect(identity).not.toContainText('Personal')
  })

  test('shows the log out label on hover and on keyboard focus', async ({
    page,
    modelsAccount
  }) => {
    await page.goto('/login/')
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(modelsAccount.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(modelsAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    await page
      .getByTestId('mobile-nav-cta')
      .getByTestId('header-account')
      .click()

    const signOut = page.getByTestId('account-sign-out')
    const label = signOut.getByText('Log out')
    await expect(signOut).toBeVisible()
    await expect(label).toBeHidden()

    await page.getByTestId('account-email').hover()
    await expect(label).toBeVisible()

    await page.mouse.move(0, 0)
    await expect(label).toBeHidden()

    await signOut.focus()
    await expect(label).toBeVisible()
  })

  test('opens one shared credits dialog and resets it after closing', async ({
    page,
    modelsAccount
  }) => {
    await page.goto('/login/')
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(modelsAccount.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(modelsAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    const account = page
      .getByTestId('mobile-nav-cta')
      .getByTestId('header-account')
    await account.click()
    await page.getByTestId('account-add-credits').click()

    const dialog = page.getByTestId('buy-credits-dialog')
    await expect(dialog).toHaveCount(1)
    await page.getByTestId('buy-credits-pack-50').click()
    await expect(page.getByTestId('buy-credits-custom')).toContainText(
      '$50 · 10,550'
    )
    await page.getByTestId('buy-credits-cancel').click()
    await expect(dialog).toHaveCount(0)

    await account.click()
    await page.getByTestId('account-add-credits').click()
    await expect(dialog).toHaveCount(1)
    await expect(page.getByTestId('buy-credits-pack-25')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
