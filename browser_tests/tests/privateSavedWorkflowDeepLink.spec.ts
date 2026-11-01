import { readFileSync } from 'node:fs'

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { UserDataFullInfo } from '@comfyorg/api-client/types'
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
  const snapshot = {
    id: WORKFLOW_ID,
    path: WORKFLOW_PATH,
    content: workflow,
    modified: 1,
    size: new TextEncoder().encode(workflow).length
  }
  const state = {
    snapshot,
    pathReads: 0,
    browserClears: 0,
    selectedStandard: false,
    readAuthorizations: [] as Array<string | null>
  }

  await page.route('**/api/userdata-files/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path !== `/api/userdata-files/${WORKFLOW_ID}`) return route.fallback()
    state.readAuthorizations.push(
      await route.request().headerValue('authorization')
    )
    if (status !== 200) return route.fulfill({ status })
    return route.fulfill(jsonRoute(snapshot))
  })
  await page.route('**/api/userdata-files/*/path/**', (route) => {
    state.pathReads++
    return route.fulfill({ status: 412 })
  })
  await page.route('**/api/userdata?*', (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() !== 'GET' ||
      url.searchParams.get('dir') !== 'workflows'
    )
      return route.fallback()
    const files: UserDataFullInfo[] = [
      {
        id: WORKFLOW_ID,
        path: `${RECORD_NAME}.json`,
        modified: 1,
        size: workflow.length
      }
    ]
    return route.fulfill(jsonRoute(files))
  })
  await page.route('**/api/userdata/*', (route) => {
    const path = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/userdata/')[1]
    )
    if (route.request().method() !== 'GET' || path !== WORKFLOW_PATH)
      return route.fallback()
    state.pathReads++
    return route.fulfill({ status: 412 })
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
          `/?workspace=ws-personal&environment=standard&savedFile=${WORKFLOW_ID}`,
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
      expect(state.pathReads).toBe(0)
      expect(state.browserClears).toBe(1)
      expect(state.readAuthorizations).toEqual([
        'Bearer mock-workspace-token-ws-personal'
      ])
      expect(new URL(comfyPage.page.url()).searchParams.has('savedFile')).toBe(
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

    test('keeps the existing canvas when the private saved file is inaccessible', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const original = await comfyPage.workflow.getActiveWorkflowPath()
      await mockPrivateWorkflow(comfyPage.page, 403)

      await comfyPage.page.goto(
        new URL(
          `/?workspace=ws-personal&savedFile=${WORKFLOW_ID}`,
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

    test('refuses an old record link without fetching or replacing the existing canvas', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const original = await comfyPage.workflow.getActiveWorkflowPath()
      const state = await mockPrivateWorkflow(comfyPage.page)
      await comfyPage.page.goto(
        new URL(
          `/?workspace=ws-personal&workflow=${WORKFLOW_ID}`,
          comfyPage.url
        ).toString()
      )
      await comfyPage.waitForAppReady()
      await expect(
        comfyPage.toast.withText('This old workflow link is unavailable.')
      ).toBeVisible()
      expect(await comfyPage.workflow.getActiveWorkflowPath()).toBe(original)
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBeGreaterThan(0)
      expect(state.readAuthorizations).toEqual([])
      expect(state.pathReads).toBe(0)
    })

    test('restores same-ID dirty saved state after a server rename without reading a replacement path', async ({
      comfyPage
    }) => {
      const state = await mockPrivateWorkflow(comfyPage.page)
      const link = new URL(
        `/?workspace=ws-personal&savedFile=${WORKFLOW_ID}`,
        comfyPage.url
      ).toString()
      await comfyPage.page.goto(link)
      await comfyPage.waitForAppReady()
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toBe(WORKFLOW_PATH)
      const before = await comfyPage.nodeOps.getGraphNodesCount()
      await (await comfyPage.nodeOps.getNodeRefByType('KSampler')).delete()
      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(true)
      await expect
        .poll(() =>
          comfyPage.page.evaluate((id) => {
            return Object.keys(localStorage)
              .filter((key) => key.startsWith('Comfy.Workflow.DraftIndex.v2:'))
              .some((key) => {
                const index: unknown = JSON.parse(
                  localStorage.getItem(key) ?? 'null'
                )
                return JSON.stringify(index).includes(id)
              })
          }, WORKFLOW_ID)
        )
        .toBe(true)
      state.snapshot.path = 'workflows/renamed-private.json'
      await comfyPage.page.goto(link)
      await comfyPage.waitForAppReady()
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toBe(state.snapshot.path)
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(before - 1)
      expect(await comfyPage.workflow.isCurrentWorkflowModified()).toBe(true)
      expect(state.pathReads).toBe(0)
    })
  }
)
