import { expect } from '@playwright/test'

import type { ListWorkspacesResponse } from '@comfyorg/ingest-types'

import { MODEL_PATH, test } from './fixtures/modelsAccount'

const WORKSPACES: ListWorkspacesResponse = {
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

test('switching workspace during a run asks before it throws the run away', async ({
  page,
  modelsAccount
}) => {
  await page.route('**/api/workspaces', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WORKSPACES)
    })
  )
  // The run never answers, so it is still going when the workspace changes.
  await page.route('**/v2/models/**', () => {})

  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(modelsAccount.email)
  await page
    .getByLabel('Password', { exact: true })
    .fill(modelsAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')

  await page.goto(MODEL_PATH)
  await page.getByTestId('field-prompt').fill('A teapot')
  await page.getByTestId('run-button').click()
  const output = page.getByTestId('playground-output')
  await expect(output).toHaveAttribute('data-state', 'running')

  const account = page
    .getByTestId('desktop-nav-cta')
    .getByTestId('header-account')
  const otherWorkspace = async () => {
    await account.click()
    await page.getByTestId('account-workspace').click()
    await page.getByTestId('account-workspace-ws-team').click()
  }

  await otherWorkspace()
  const dialog = page.getByTestId('run-leave-dialog')
  await expect(dialog).toBeVisible()

  await page.getByTestId('run-leave-stay').click()
  await expect(dialog).toBeHidden()
  await expect(output).toHaveAttribute('data-state', 'running')

  await otherWorkspace()
  await page.getByTestId('run-leave-confirm').click()
  await expect(output).toHaveAttribute('data-state', 'cancelled')
})
