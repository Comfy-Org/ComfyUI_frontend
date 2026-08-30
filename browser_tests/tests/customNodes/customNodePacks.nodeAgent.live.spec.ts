import type { APIRequestContext, Route } from '@playwright/test'

import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const managerUrl =
  process.env.CUSTOM_NODE_MANAGER_URL ?? 'http://127.0.0.1:8096'
const verificationLine = 'Live Node Agent verification.'

interface EditorFilesResponse {
  files: Array<{ path: string; content: string }>
  digest: string
}

function managerPath(browserUrl: string): string | undefined {
  const url = new URL(browserUrl)
  const editorPrefix = '/api/customnodes/editor/sessions'
  if (url.pathname.startsWith(editorPrefix)) {
    return `/v1/editor/sessions${url.pathname.slice(editorPrefix.length)}${url.search}`
  }
  if (url.pathname === '/api/customnodes') {
    return `/v1/uploads${url.search}`
  }
  const download = url.pathname.match(/^\/api\/customnodes\/([^/]+)\/download$/)
  if (download) {
    return `/v1/uploads/${download[1]}/download${url.search}`
  }
}

async function proxyToManager(
  route: Route,
  owner: string,
  onSessionCreated: (id: string) => void
) {
  const targetPath = managerPath(route.request().url())
  if (!targetPath) {
    await route.fallback()
    return
  }

  const headers = await route.request().allHeaders()
  delete headers.authorization
  delete headers.host
  headers['x-comfy-workspace'] = owner

  const response = await route.fetch({
    url: `${managerUrl}${targetPath}`,
    headers,
    timeout: 360_000
  })
  if (
    route.request().method() === 'POST' &&
    targetPath === '/v1/editor/sessions'
  ) {
    const session = (await response.json()) as { id?: unknown }
    if (typeof session.id === 'string') onSessionCreated(session.id)
  }
  await route.fulfill({ response })
}

async function getFiles(
  request: APIRequestContext,
  owner: string,
  sessionId: string
): Promise<EditorFilesResponse> {
  const response = await request.get(
    `${managerUrl}/v1/editor/sessions/${encodeURIComponent(sessionId)}/files`,
    { headers: { 'X-Comfy-Workspace': owner } }
  )
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()) as EditorFilesResponse
}

test.describe(
  'Custom node Node Agent live integration',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.describe.configure({ timeout: 420_000 })

    test('tests a real proposal before explicitly applying it', async ({
      page,
      request
    }) => {
      const owner = `playwright-node-agent-live-${Date.now()}`
      let sessionId: string | undefined

      await setupCloudApp(page, {
        workspace: workspace('personal', 'owner')
      })
      await page.route('**/api/customnodes**', (route) =>
        proxyToManager(route, owner, (id) => {
          sessionId = id
        })
      )

      try {
        const comfyPage = new ComfyPage(page, request)
        await page.goto(APP_URL)
        await comfyPage.waitForAppReady()

        const closeWarning = page
          .getByRole('alert')
          .getByRole('button', { name: 'Close' })
        if (await closeWarning.isVisible()) await closeWarning.click()
        const closeTemplateDialog = page.getByRole('button', {
          name: 'Close dialog'
        })
        if (await closeTemplateDialog.isVisible()) {
          await closeTemplateDialog.click()
        }

        await comfyPage.menu.nodeLibraryTabV2.open()
        await comfyPage.menu.nodeLibraryTabV2.sidebarContent
          .getByRole('button', { name: 'Custom Nodes', exact: true })
          .click()
        await page.getByRole('button', { name: 'Create', exact: true }).click()
        await expect(page.getByTestId('custom-node-workbench')).toBeVisible()
        expect(sessionId).toBeTruthy()

        const initial = await getFiles(request, owner, sessionId!)
        const initialReadme = initial.files.find(
          (file) => file.path === 'README.md'
        )
        expect(initialReadme?.content).not.toContain(verificationLine)

        await page
          .getByRole('textbox', {
            name: 'For example: add a color input and use it for the dark checkerboard squares'
          })
          .fill(
            `Change only README.md by appending a new final line containing exactly: ${verificationLine} Do not alter node behavior. Use the existing packaged workflow and call the test_node tool before returning the proposal.`
          )
        await page
          .getByRole('button', { name: 'Propose changes', exact: true })
          .click()

        const testResult = page.getByTestId('node-agent-test-result')
        await expect(testResult).toContainText('Backend test passed', {
          timeout: 360_000
        })
        await expect(testResult).toContainText('Phase: complete')
        await expect(testResult).toContainText('Sandbox: seatbelt')
        await expect(
          testResult.getByRole('img', {
            name: 'Draft test preview for output 1'
          })
        ).toBeVisible()
        await expect(
          page.getByLabel('Node Agent proposed changes')
        ).toBeVisible()

        const beforeApply = await getFiles(request, owner, sessionId!)
        expect(beforeApply.digest).toBe(initial.digest)
        expect(
          beforeApply.files.find((file) => file.path === 'README.md')?.content
        ).not.toContain(verificationLine)

        await page
          .getByRole('button', { name: 'Apply changes', exact: true })
          .click()
        await expect(
          page.getByRole('button', { name: 'Apply changes', exact: true })
        ).toBeHidden()

        await expect
          .poll(
            async () => {
              const applied = await getFiles(request, owner, sessionId!)
              return {
                changed: applied.digest !== initial.digest,
                containsVerification: applied.files
                  .find((file) => file.path === 'README.md')
                  ?.content.includes(verificationLine)
              }
            },
            { timeout: 30_000 }
          )
          .toEqual({ changed: true, containsVerification: true })
      } finally {
        if (sessionId) {
          await request.delete(
            `${managerUrl}/v1/editor/sessions/${encodeURIComponent(sessionId)}`,
            { headers: { 'X-Comfy-Workspace': owner } }
          )
        }
      }
    })
  }
)
