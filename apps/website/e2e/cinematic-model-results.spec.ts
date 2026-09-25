import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type {
  ExchangeTokenResponse,
  ListWorkspacesResponse
} from '@comfyorg/ingest-types'
import { zExchangeTokenRequest } from '@comfyorg/ingest-types/zod'

import { AccountMenu } from './fixtures/accountMenu'
import { MODEL_PATH, test } from './fixtures/modelsAccount'

async function completeNativeResult(
  page: Page,
  context: BrowserContext,
  account: { email: string; password: string }
) {
  const submissions: string[] = []
  const outputUrl = 'https://output.example/library-frame.webp'
  await context.route('**/v2/models/**', (route) => {
    if (!route.request().url().includes('/bfl/flux-2-max/requests'))
      return route.abort()
    const method = route.request().method()
    if (method === 'POST') {
      submissions.push(route.request().url())
      return route.fulfill({
        status: 201,
        json: {
          request_id: 'f0b55482-d90f-4c9f-8fda-351ece95aaee',
          status: 'IN_QUEUE'
        }
      })
    }
    if (method === 'GET')
      return route.fulfill({
        json: {
          id: 'generation',
          status: 'Ready',
          result: { sample: outputUrl }
        }
      })
    return route.abort()
  })
  await context.route(outputUrl, (route) =>
    route.fulfill({
      path: 'e2e/assets/placeholder-1x1.webp',
      contentType: 'image/webp',
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  )
  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.goto(MODEL_PATH)
  await page.getByTestId('field-prompt').fill('A harbor at sunrise')
  await page.getByTestId('run-button').click()
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'succeeded'
  )
  await expect(
    page.getByText('Saved to Your creations', { exact: true })
  ).toBeVisible()
  expect(submissions).toHaveLength(1)
  return submissions
}

async function openResults(page: Page, path = '/cinematic-studio/') {
  await page.goto(path)
  await page
    .getByRole('button', { name: 'Your creations', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Your creations',
    exact: true
  })
  await dialog
    .getByRole('button', { name: 'Model & tool results', exact: true })
    .click()
  const results = dialog.getByRole('region', {
    name: 'Model & tool results',
    exact: true
  })
  await expect(
    results.getByText('Loading model results…', { exact: true })
  ).toBeHidden()
  return results
}

test('native image results persist in Your creations, download locally and require confirmation to delete', async ({
  page,
  context,
  modelsAccount
}) => {
  const submissions = await completeNativeResult(page, context, modelsAccount)
  await page.getByRole('link', { name: 'Your creations', exact: true }).click()
  await expect(page).toHaveURL(/\/cinematic-studio\/?\?library=model-results/)
  let results = page
    .getByRole('dialog', { name: 'Your creations', exact: true })
    .getByRole('region', { name: 'Model & tool results', exact: true })
  await expect(results.getByRole('article')).toHaveCount(1)
  await expect(results.getByRole('img')).toBeVisible()
  await expect(results.getByRole('img')).toHaveAttribute('src', /^blob:/)
  await expect(results.getByRole('img')).toHaveJSProperty('naturalWidth', 1)

  results = await openResults(page)
  await expect(results.getByRole('article')).toHaveCount(1)
  const downloading = page.waitForEvent('download')
  await results.getByRole('link', { name: 'Download', exact: true }).click()
  const downloaded = await downloading
  expect(downloaded.suggestedFilename()).toMatch(/\.webp$/)
  expect(await downloaded.failure()).toBeNull()
  await results.getByRole('button', { name: 'Animate', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Your creations', exact: true })
  ).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Video', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')

  const demo = await openResults(page, '/cinematic-studio/?demo=success')
  await expect(demo.getByRole('article')).toHaveCount(0)
  results = await openResults(page)
  await expect(results.getByRole('article')).toHaveCount(1)
  await results
    .getByRole('button', { name: 'Remove result', exact: true })
    .click()
  await expect(
    results.getByText(
      'Remove this saved result and all its files from this browser?',
      { exact: true }
    )
  ).toBeVisible()
  await results.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(results.getByRole('article')).toHaveCount(1)
  await results
    .getByRole('button', { name: 'Remove result', exact: true })
    .click()
  await results
    .getByRole('button', { name: 'Remove result', exact: true })
    .last()
    .click()
  await expect(results.getByRole('article')).toHaveCount(0)
  results = await openResults(page)
  await expect(results.getByRole('article')).toHaveCount(0)
  expect(submissions).toHaveLength(1)
})

test('native saved results stay in the submitting workspace after switching workspaces', async ({
  page,
  context,
  modelsAccount
}) => {
  const workspaces: ListWorkspacesResponse = {
    workspaces: [
      {
        id: 'ws-personal',
        name: 'Personal',
        type: 'personal',
        role: 'owner',
        created_at: '2026-01-01T00:00:00Z',
        joined_at: '2026-01-01T00:00:00Z'
      },
      {
        id: 'ws-team',
        name: 'Comfy',
        type: 'team',
        role: 'member',
        created_at: '2026-01-01T00:00:00Z',
        joined_at: '2026-01-01T00:00:00Z'
      }
    ]
  }
  await page.route('**/api/workspaces', (route) =>
    route.fulfill({ json: workspaces })
  )
  await page.route('**/api/auth/token', (route) => {
    const request = zExchangeTokenRequest.safeParse(
      route.request().postDataJSON()
    )
    if (!request.success || request.data.workspace_id !== 'ws-team')
      return route.fallback()
    return route.fulfill({
      json: {
        token: 'mock-team-jwt',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        workspace: { id: 'ws-team', name: 'Comfy', type: 'team' },
        role: 'member',
        permissions: []
      } satisfies ExchangeTokenResponse
    })
  })
  const submissions = await completeNativeResult(page, context, modelsAccount)
  const accountMenu = new AccountMenu(page)
  await accountMenu.pickWorkspace('ws-team')
  await accountMenu.open()
  await expect(page.getByTestId('account-workspace-current')).toContainText(
    'Comfy'
  )
  const teamResults = await openResults(page)
  await expect(teamResults.getByRole('article')).toHaveCount(0)
  await page.goto(MODEL_PATH)
  await accountMenu.pickWorkspace('ws-personal')
  await accountMenu.open()
  await expect(page.getByTestId('account-workspace-current')).toContainText(
    'Personal'
  )
  const personalResults = await openResults(page)
  await expect(personalResults.getByRole('article')).toHaveCount(1)
  await expect(personalResults.getByRole('img')).toBeVisible()
  expect(submissions).toHaveLength(1)
})
