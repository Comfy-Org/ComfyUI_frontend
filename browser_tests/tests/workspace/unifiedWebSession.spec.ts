import { zPromptRequest } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  PROMPT_ACCEPTED,
  SESSION_REVOKED,
  WEB_SESSION_COOKIE,
  WEB_SESSION_CSRF_TOKEN,
  WEB_SESSION_MINT,
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
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.toast.closeToasts()
      await comfyPage.runButton.click()
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

    test('the prompt carries the one workspace token minted from the session', async ({
      comfyPage,
      tokenMints
    }) => {
      const page = comfyPage.page
      await mockPromptAccepted(page)

      const promptRequest = page.waitForRequest(isPromptPost)
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.toast.closeToasts()
      await comfyPage.runButton.click()
      const request = await promptRequest

      expect(tokenMints).toEqual([
        {
          body: { workspace_id: TEAM_WORKSPACE_ID },
          authorization: undefined,
          workspace: TEAM_WORKSPACE_ID
        }
      ])
      expect(zPromptRequest.parse(request.postDataJSON()).extra_data).toEqual(
        expect.objectContaining({
          auth_token_comfy_org: WEB_SESSION_MINT.token
        })
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

  test('a session revoked elsewhere sends the open tab to the login page when it becomes visible', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await comfyPage.waitForAppReady()
    expect(page.url()).not.toContain('/cloud/login')

    await page.route('**/api/auth/session', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify(SESSION_REVOKED)
          })
        : route.fallback()
    )
    await page.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange'))
    )

    await expect(page).toHaveURL(/\/cloud\/login/)
  })

  test('[E2E-03] switching workspace mints nothing until the next Run, which uses the new workspace', async ({
    comfyPage,
    tokenMints
  }) => {
    const page = comfyPage.page
    await mockPromptAccepted(page)

    await test.step('switch to the team workspace', async () => {
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

      expect(tokenMints, 'workspace switch minted a token before Run').toEqual(
        []
      )
    })

    await test.step('Run in the team workspace', async () => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.toast.closeToasts()
      const promptRequest = page.waitForRequest(isPromptPost)
      await comfyPage.runButton.click()
      const headers = await (await promptRequest).allHeaders()

      expect(headers[WORKSPACE_HEADER]).toBe(TEAM_WORKSPACE_ID)
      expect(tokenMints.map(({ workspace }) => workspace)).toEqual([
        TEAM_WORKSPACE_ID
      ])
    })
  })

  test.describe('arrived from the website with no Firebase login', () => {
    test.use({ firebaseLogin: false })

    test('boots on the session: no login page, the session user, a Run on the cookie, no Firebase traffic', async ({
      comfyPage,
      firebaseRequests,
      credentialedFeatureReads
    }) => {
      const page = comfyPage.page
      await mockPromptAccepted(page)
      await comfyPage.waitForAppReady()
      expect(page.url()).not.toContain('/cloud/login')

      await comfyPage.toast.closeToasts()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Current user' }).click()
      await expect(page.getByText(CLOUD_SELF_EMAIL)).toBeVisible()
      await page.keyboard.press('Escape')

      const promptRequest = page.waitForRequest(isPromptPost)
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.toast.closeToasts()
      await comfyPage.runButton.click()
      const headers = await (await promptRequest).allHeaders()

      expect(headers['x-csrf-token']).toBe(WEB_SESSION_CSRF_TOKEN)
      expect(headers['authorization']).toBeUndefined()
      expect(firebaseRequests).toEqual([])
      expect(credentialedFeatureReads.length).toBeGreaterThan(0)
      expect(credentialedFeatureReads[0].headers()['x-comfy-client']).toMatch(
        /^@comfyorg\/account-core\//
      )
    })
  })
})
