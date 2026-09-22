import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  ExchangeTokenResponse,
  ListWorkspacesResponse
} from '@comfyorg/ingest-types'
import { zExchangeTokenRequest } from '@comfyorg/ingest-types/zod'

import { AccountMenu } from './fixtures/accountMenu'
import { MODEL_PATH, MODELS_WORKSPACE_ID, test } from './fixtures/modelsAccount'

const API_KEYS_URL =
  'https://platform.comfy.org/profile/api-keys?onboarding=models&model=bfl--flux-2-max--generate-images'

const WORKSPACES: ListWorkspacesResponse = {
  workspaces: [
    {
      id: MODELS_WORKSPACE_ID,
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

test('the API key link stays a models onboarding arrival when signed out', async ({
  page
}) => {
  await page.goto(MODEL_PATH)
  await page.getByTestId('tab-api').click()
  await expect(page.getByTestId('api-get-key')).toHaveAttribute(
    'href',
    API_KEYS_URL
  )
})

test('the API key link carries the active workspace, and follows a switch', async ({
  page,
  modelsAccount
}) => {
  await mockWorkspaces(page)
  await signIn(page, modelsAccount)

  await page.goto(MODEL_PATH)
  await page.getByTestId('tab-api').click()
  const link = page.getByTestId('api-get-key')
  await expect(link).toHaveAttribute(
    'href',
    `${API_KEYS_URL}&workspace=${MODELS_WORKSPACE_ID}`
  )

  await new AccountMenu(page).pickWorkspace(TEAM.id)
  await expect(link).toHaveAttribute(
    'href',
    `${API_KEYS_URL}&workspace=${TEAM.id}`
  )
})
