import { readFileSync } from 'node:fs'

import type {
  GetWorkflowContentResponse,
  GetWorkflowResponse
} from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { z } from 'zod'

import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'
import { workspaceSwitcherTest } from '@e2e/fixtures/workspaceSwitcherFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { resolveSetupApiUrl } from '@e2e/utils/e2eConfig'

const test = workspaceSwitcherTest.extend({
  page: async ({ page, request }, use) => {
    await page.route('**/api/users', async (route) => {
      const response = await request.get(`${resolveSetupApiUrl()}/api/users`)
      await route.fulfill({ response })
    })
    await use(page)
  }
})

const WORKFLOW_ID = 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
const RECORD_NAME = 'private-link/Private workflow'
const WORKFLOW_PATH = `workflows/${RECORD_NAME}.json`

async function mockPrivateWorkflow(page: Page, status = 200) {
  const workflow = readFileSync(assetPath('default.json'), 'utf-8')
  const metadata: GetWorkflowResponse = {
    id: WORKFLOW_ID,
    name: RECORD_NAME,
    created_at: '2026-10-24T00:00:00Z',
    updated_at: '2026-10-24T00:00:00Z',
    created_by: 'uid-1',
    latest_version: 1
  }
  const content: GetWorkflowContentResponse = {
    id: 'version-1',
    version: 1,
    created_at: '2026-10-24T00:00:00Z',
    created_by: 'uid-1',
    workflow_json: z.record(z.string(), z.unknown()).parse(JSON.parse(workflow))
  }
  const state = {
    browserClears: 0,
    selectedStandard: false,
    readAuthorizations: [] as Array<string | null>
  }

  await page.route('**/api/workflows/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith(`/api/workflows/${WORKFLOW_ID}`))
      return route.fallback()
    state.readAuthorizations.push(
      await route.request().headerValue('authorization')
    )
    if (status !== 200) return route.fulfill({ status })
    return route.fulfill(
      jsonRoute(path.endsWith('/content') ? content : metadata)
    )
  })
  await page.route('**/api/userdata?*', (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() !== 'GET' ||
      url.searchParams.get('dir') !== 'workflows'
    )
      return route.fallback()
    const files: UserDataFullInfo[] = [
      { path: `${RECORD_NAME}.json`, modified: 1, size: workflow.length }
    ]
    return route.fulfill(jsonRoute(files))
  })
  await page.route('**/api/userdata/*', (route) => {
    const path = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/userdata/')[1]
    )
    if (route.request().method() !== 'GET' || path !== WORKFLOW_PATH)
      return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: workflow })
  })
  await page.route('**/api/workspaces/ws-personal/deployments', (route) => {
    const listing: WorkspaceDeploymentList = {
      builds_visible: true,
      picked_deployment_id: state.selectedStandard ? undefined : 'dep-test',
      pick_source: 'browser',
      items: [
        {
          deployment_id: 'dep-test',
          release_id: 'release-test',
          build_id: 'build-test',
          build_name: 'Test build',
          release_version: 1,
          status: 'ready',
          can_start: false,
          created_at: '2026-10-24T00:00:00Z'
        }
      ]
    }
    return route.fulfill(jsonRoute(listing))
  })
  await page.route('**/api/workspaces/ws-personal/deployment', (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    state.browserClears++
    state.selectedStandard = true
    return route.fulfill({ status: 204 })
  })
  return state
}

test.describe(
  'Private saved workflow deep link',
  { tag: ['@cloud', '@canvas'] },
  () => {
    test.use({ initialSettings: { 'Comfy.Workflow.Persist': true } })

    test('opens the normal saved document on standard Cloud and preserves an unsaved tab', async ({
      comfyPage
    }, testInfo) => {
      test.slow()
      await comfyPage.workflow.loadWorkflow('default')
      const unsavedName = await comfyPage.menu.topbar.getActiveTabName()
      const state = await mockPrivateWorkflow(comfyPage.page)

      await comfyPage.page.goto(
        new URL(
          `/?workspace=ws-personal&environment=standard&workflow=${WORKFLOW_ID}`,
          comfyPage.url
        ).toString()
      )
      await comfyPage.page.waitForEvent('load', { timeout: 30_000 })
      await comfyPage.waitForAppReady()

      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toBe(WORKFLOW_PATH)
      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .toEqual(expect.arrayContaining([unsavedName, 'Private workflow']))
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)
      expect(state.browserClears).toBe(1)
      expect(state.readAuthorizations).toEqual([
        'Bearer mock-workspace-token-ws-personal',
        'Bearer mock-workspace-token-ws-personal'
      ])
      expect(new URL(comfyPage.page.url()).searchParams.has('workflow')).toBe(
        false
      )
      const screenshot = testInfo.outputPath(
        'private-saved-workflow-standard.png'
      )
      await comfyPage.page.screenshot({ path: screenshot })
      await testInfo.attach('private-saved-workflow-standard', {
        path: screenshot,
        contentType: 'image/png'
      })
    })

    test('keeps the existing canvas when the private record is inaccessible', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const original = await comfyPage.workflow.getActiveWorkflowPath()
      await mockPrivateWorkflow(comfyPage.page, 403)

      await comfyPage.page.goto(
        new URL(
          `/?workspace=ws-personal&workflow=${WORKFLOW_ID}`,
          comfyPage.url
        ).toString()
      )
      await comfyPage.waitForAppReady()

      await expect(
        comfyPage.toast.withText('This saved workflow is unavailable.')
      ).toBeVisible()
      expect(await comfyPage.workflow.getActiveWorkflowPath()).toBe(original)
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBeGreaterThan(0)
    })
  }
)
