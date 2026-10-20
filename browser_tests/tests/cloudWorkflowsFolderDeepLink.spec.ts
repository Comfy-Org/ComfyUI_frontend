import { readFileSync } from 'fs'

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'

const FOLDER = 'deploy-build'
const FOLDER_FILES = ['b-second.json', 'a-first.json']

/**
 * Serves a userdata folder of saved workflows: the `workflows` listing names
 * the folder's files, and a GET of one returns a workflow.
 */
async function mockWorkflowsFolder(page: Page) {
  const workflow = readFileSync(assetPath('default.json'), 'utf-8')

  await page.route('**/api/userdata?*', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== 'GET') return route.fallback()
    if (url.searchParams.get('dir') !== 'workflows') return route.fallback()
    const listing: UserDataFullInfo[] = FOLDER_FILES.map((name) => ({
      path: `${FOLDER}/${name}`,
      modified: 1,
      size: workflow.length
    }))
    return route.fulfill(jsonRoute(listing))
  })

  await page.route('**/api/userdata/*', (route) => {
    const request = route.request()
    const path = decodeURIComponent(
      new URL(request.url()).pathname.split('/userdata/')[1]
    )
    if (request.method() !== 'GET') return route.fallback()
    if (!path.startsWith(`workflows/${FOLDER}/`)) return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: workflow })
  })
}

test.describe('Cloud workflows folder deep link', { tag: '@cloud' }, () => {
  test('opens the workflows of the folder the link names instead of the last workflow', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const topbar = comfyPage.menu.topbar
    await expect.poll(() => topbar.getActiveTabName()).not.toBe('a-first')
    await mockWorkflowsFolder(page)

    await page.goto(new URL(`/?workflows=${FOLDER}`, comfyPage.url).toString())
    await comfyPage.waitForAppReady()

    await expect.poll(() => topbar.getActiveTabName()).toBe('a-first')
    await expect
      .poll(() => topbar.getTabNames())
      .toEqual(expect.arrayContaining(['a-first', 'b-second']))
    expect(await comfyPage.workflow.getActiveWorkflowPath()).toBe(
      `workflows/${FOLDER}/a-first.json`
    )
    expect(new URL(page.url()).searchParams.has('workflows')).toBe(false)
  })
})
