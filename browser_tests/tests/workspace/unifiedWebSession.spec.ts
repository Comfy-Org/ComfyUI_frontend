import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import {
  PROMPT_ACCEPTED,
  WEB_SESSION_COOKIE,
  WEB_SESSION_CSRF_TOKEN,
  WORKSPACE_ACCESS_DENIED
} from '@e2e/fixtures/data/webSession'
import {
  PERSONAL_WORKSPACE_NAME,
  TEAM_WORKSPACE_NAME
} from '@e2e/fixtures/data/workspaceSwitcher'
import { webSessionTest as test } from '@e2e/fixtures/webSessionFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKSPACE_HEADER = 'x-comfy-workspace-id'
const TEAM_WORKSPACE_ID = 'ws-team'
const PERSONAL_WORKSPACE_ID = 'ws-personal'

function isCurrentWorkspaceRead(request: Request, workspaceId: string) {
  return (
    request.method() === 'GET' &&
    new URL(request.url()).pathname === '/api/workspaces/current' &&
    request.headers()[WORKSPACE_HEADER] === workspaceId
  )
}

function isPromptPost(request: Request) {
  return (
    request.method() === 'POST' &&
    new URL(request.url()).pathname === '/api/prompt'
  )
}

async function postPrompt(page: Page) {
  await page.evaluate(() => {
    void window.app!.api.fetchApi('/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
  })
}

async function mockPromptAccepted(page: Page) {
  await page.route('**/api/prompt', (route) =>
    route.fulfill(jsonRoute(PROMPT_ACCEPTED))
  )
}

test.describe('Unified web session', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.describe('booted in the team workspace', () => {
    test.use({
      initialLocalStorage: { 'Comfy.Workspace.LastWorkspaceId': 'ws-team' }
    })

    test('a prompt request rides the cookie session with the CSRF token and workspace', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await mockPromptAccepted(page)

      const promptRequest = page.waitForRequest(isPromptPost)
      await postPrompt(page)
      const request = await promptRequest
      const headers = await request.allHeaders()

      expect(headers[WORKSPACE_HEADER]).toBe(TEAM_WORKSPACE_ID)
      expect(headers['x-csrf-token']).toBe(WEB_SESSION_CSRF_TOKEN)
      expect(headers['x-comfy-client']).toMatch(/^@comfyorg\/account-core\//)
      expect(headers['authorization']).toBeUndefined()
      expect(headers['cookie']).toContain(
        `${WEB_SESSION_COOKIE.name}=${WEB_SESSION_COOKIE.value}`
      )
    })

    test('a read names the workspace without a CSRF token', async ({
      comfyPage,
      workspaceReads
    }) => {
      await comfyPage.waitForAppReady()
      await expect
        .poll(async () => {
          const headers = await Promise.all(
            workspaceReads.map((read) => read.allHeaders())
          )
          return headers.filter(
            (h) => h[WORKSPACE_HEADER] === TEAM_WORKSPACE_ID
          ).length
        })
        .toBeGreaterThan(0)

      const [read] = workspaceReads
      const headers = await read.allHeaders()
      expect(headers[WORKSPACE_HEADER]).toBe(TEAM_WORKSPACE_ID)
      expect(headers['x-csrf-token']).toBeUndefined()
      expect(headers['x-comfy-client']).toBeDefined()
    })

    test('[E2E-06] [FS-14] a denied workspace is dropped once and never replayed in personal', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const promptWorkspaces: (string | null)[] = []
      page.on('request', (request) => {
        if (isPromptPost(request)) {
          promptWorkspaces.push(request.headers()[WORKSPACE_HEADER] ?? null)
        }
      })
      await page.route('**/api/prompt', async (route) => {
        const workspaceId = await route.request().headerValue(WORKSPACE_HEADER)
        if (workspaceId === TEAM_WORKSPACE_ID) {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify(WORKSPACE_ACCESS_DENIED)
          })
          return
        }
        await route.fulfill(jsonRoute(PROMPT_ACCEPTED))
      })

      const personalRead = page.waitForRequest((request) =>
        isCurrentWorkspaceRead(request, PERSONAL_WORKSPACE_ID)
      )
      await postPrompt(page)
      await personalRead
      await comfyPage.waitForAppReady()

      await comfyPage.toast.closeToasts()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Current user' }).click()
      await expect(
        page.getByTestId('workspace-switcher-trigger')
      ).toContainText(PERSONAL_WORKSPACE_NAME)
      expect(promptWorkspaces).toEqual([TEAM_WORKSPACE_ID])
    })
  })

  test('[E2E-03] switching workspace mints no token and sends the next prompt in the new one', async ({
    comfyPage,
    tokenMints
  }) => {
    const page = comfyPage.page
    await mockPromptAccepted(page)

    await comfyPage.toast.closeToasts()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    const switcherPanel = page.getByTestId('workspace-switcher-panel')
    await expect(switcherPanel).toBeVisible()

    const teamRead = page.waitForRequest((request) =>
      isCurrentWorkspaceRead(request, TEAM_WORKSPACE_ID)
    )
    await switcherPanel.getByText(TEAM_WORKSPACE_NAME).click()
    await teamRead
    await comfyPage.waitForAppReady()

    const promptRequest = page.waitForRequest(isPromptPost)
    await postPrompt(page)
    const headers = await (await promptRequest).allHeaders()

    expect(headers[WORKSPACE_HEADER]).toBe(TEAM_WORKSPACE_ID)
    expect(tokenMints, 'switch mints no workspace token').toEqual([])
  })
})
