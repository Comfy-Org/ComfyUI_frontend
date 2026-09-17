import { expect } from '@playwright/test'

import type {
  ExchangeTokenResponse,
  ListWorkspacesResponse
} from '@comfyorg/ingest-types'
import { zExchangeTokenRequest } from '@comfyorg/ingest-types/zod'

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

const TEAM = WORKSPACES.workspaces[1]

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
  // The fixture mints the personal workspace for every exchange, so the one
  // that asks for the team needs an answer of its own or the switch lands
  // back where it started and says nothing.
  await page.route('**/api/auth/token', (route) => {
    const asked = zExchangeTokenRequest.safeParse(
      route.request().postDataJSON()
    )
    if (!asked.success || asked.data.workspace_id !== TEAM.id)
      return route.fallback()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mock-team-jwt',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: { id: TEAM.id, name: TEAM.name, type: TEAM.type },
        role: TEAM.role,
        permissions: []
      } satisfies ExchangeTokenResponse)
    })
  })
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

  await account.click()
  await expect(page.getByTestId('account-workspace-current')).toContainText(
    TEAM.name
  )
})
