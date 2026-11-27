import { readFileSync } from 'fs'

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { UserDataFullInfo } from '@comfyorg/api-client/types'
import type {
  WorkspaceDeployment,
  WorkspaceDeploymentList
} from '@comfyorg/ingest-types'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const DEPLOYMENT: WorkspaceDeployment = {
  deployment_id: 'dep-flux',
  deployment_name: 'production',
  release_id: 'release-flux',
  build_id: '0f3c9a7e-5b21-4c8d-9e2a-1b2c3d4e5f60',
  build_name: 'Flux Studio',
  release_version: 1,
  status: 'ready',
  can_start: false,
  created_at: '2026-11-20T00:00:00Z'
}
const BUILD_FOLDER = 'Flux Studio (0f3c9a7e)'
const BUILD_WORKFLOW = `workflows/${BUILD_FOLDER}/portrait.json`

async function mockDeploymentPicks(page: Page) {
  const picked: { id?: string } = {}
  await page.route('**/api/workspaces/*/deployments', (route) => {
    const listing: WorkspaceDeploymentList = {
      builds_visible: true,
      items: [DEPLOYMENT],
      ...(picked.id
        ? { picked_deployment_id: picked.id, pick_source: 'browser' }
        : {})
    }
    return route.fulfill(jsonRoute(listing))
  })
  await page.route('**/api/workspaces/*/deployment', (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const body = route.request().postDataJSON() as { deployment_id: string }
    picked.id = body.deployment_id
    return route.fulfill(jsonRoute({}))
  })
}

async function mockBuildFolder(page: Page) {
  const workflow = readFileSync(assetPath('default.json'), 'utf-8')
  await page.route('**/api/userdata?*', (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== 'GET') return route.fallback()
    if (url.searchParams.get('dir') !== 'workflows') return route.fallback()
    const listing: UserDataFullInfo[] = [
      { path: `${BUILD_FOLDER}/portrait.json`, modified: 1, size: 1 }
    ]
    return route.fulfill(jsonRoute(listing))
  })
  await page.route('**/api/userdata/workflows*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: workflow })
  })
}

async function activeWorkflowPath(page: Page) {
  return page
    .evaluate(
      () => window.app?.extensionManager.workflow.activeWorkflow?.path ?? null
    )
    .catch(() => null)
}

test.describe(
  "A deployment opens its Build's workflows",
  { tag: '@cloud' },
  () => {
    test.beforeEach(async ({ page }) => {
      await setupCloudApp(page, {
        workspace: workspace('personal', 'owner'),
        features: { subscription_required: false }
      })
      await page.route('**/templates/index*.json', (route) =>
        route.fulfill(jsonRoute([]))
      )
      await mockDeploymentPicks(page)
      await mockBuildFolder(page)
    })

    test("a pick in Run on opens the deployment's Build workflow after the reload", async ({
      page
    }) => {
      test.setTimeout(90_000)

      await test.step('Boot on Comfy Cloud', async () => {
        await page.goto(APP_URL)
        await expect
          .poll(() => activeWorkflowPath(page), { timeout: 45_000 })
          .not.toBeNull()
        expect(await activeWorkflowPath(page)).not.toBe(BUILD_WORKFLOW)
        await page.getByRole('button', { name: 'Close dialog' }).click()
        await expect(page.getByTestId('dialog-overlay')).toBeHidden()
      })

      await test.step('Pick the deployment in Run on', async () => {
        await page.getByTestId('deployment-switcher-trigger').click()
        const reloaded = page.waitForEvent('load')
        await page
          .getByTestId(`deployment-row-${DEPLOYMENT.deployment_id}`)
          .click()
        await reloaded
      })

      await test.step("The Build's workflow is in front after the reload", async () => {
        await expect
          .poll(() => activeWorkflowPath(page), { timeout: 45_000 })
          .toBe(BUILD_WORKFLOW)
      })
    })

    test("a deployment link that names no workflow opens the Build's workflow", async ({
      page
    }) => {
      test.setTimeout(90_000)
      const link = new URL(APP_URL)
      link.searchParams.set('workspace', 'ws-personal')
      link.searchParams.set('deployment', DEPLOYMENT.deployment_id)

      await page.goto(link.toString())

      await expect
        .poll(() => activeWorkflowPath(page), { timeout: 60_000 })
        .toBe(BUILD_WORKFLOW)
    })
  }
)
