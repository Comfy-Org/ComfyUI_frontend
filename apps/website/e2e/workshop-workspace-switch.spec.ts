import type { Page } from '@playwright/test'
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

async function mockWorkspaces(page: Page) {
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
}

async function signIn(
  page: Page,
  account: { email: string; password: string }
) {
  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
}

async function startRun(page: Page) {
  await page.goto(MODEL_PATH)
  await page.getByTestId('field-prompt').fill('A teapot')
  await page.getByTestId('run-button').click()
  const output = page.getByTestId('playground-output')
  await expect(output).toHaveAttribute('data-state', 'running')
  return output
}

function accountMenu(page: Page) {
  const trigger = page
    .getByTestId('desktop-nav-cta')
    .getByTestId('header-account')
  return {
    open: () => trigger.click(),
    pickTeam: async () => {
      await trigger.click()
      await page.getByTestId('account-workspace').click()
      await page.getByTestId(`account-workspace-${TEAM.id}`).click()
    }
  }
}

test('switching workspace during a run asks before it throws the run away', async ({
  page,
  modelsAccount
}) => {
  await mockWorkspaces(page)
  // The run never answers, so it is still going when the workspace changes.
  await page.route('**/v2/models/**', () => {})

  await signIn(page, modelsAccount)
  const output = await startRun(page)
  const menu = accountMenu(page)

  await menu.pickTeam()
  const dialog = page.getByTestId('run-leave-dialog')
  await expect(dialog).toBeVisible()

  await page.getByTestId('run-leave-stay').click()
  await expect(dialog).toBeHidden()
  await expect(output).toHaveAttribute('data-state', 'running')

  await menu.pickTeam()
  await page.getByTestId('run-leave-confirm').click()
  await expect(output).toHaveAttribute('data-state', 'cancelled')

  await menu.open()
  await expect(page.getByTestId('account-workspace-current')).toContainText(
    TEAM.name
  )
})

test('a run that ends under the question answers it', async ({
  page,
  modelsAccount
}) => {
  await mockWorkspaces(page)
  // The run is held until the dialog is up, then it ends on its own.
  let land = () => {}
  const held = new Promise<void>((resolve) => {
    land = resolve
  })
  await page.route('**/v2/models/**', async (route) => {
    await held
    await route.fulfill({
      status: 503,
      headers: { 'X-Comfy-Error-Type': 'provider_error' },
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Temporary provider error' })
    })
  })

  await signIn(page, modelsAccount)
  const output = await startRun(page)
  const menu = accountMenu(page)

  await menu.pickTeam()
  const dialog = page.getByTestId('run-leave-dialog')
  await expect(dialog).toBeVisible()

  land()

  await expect(output).toHaveAttribute('data-state', 'failed')
  await expect(dialog).toBeHidden()

  await menu.open()
  await expect(page.getByTestId('account-workspace-current')).toContainText(
    TEAM.name
  )
})
