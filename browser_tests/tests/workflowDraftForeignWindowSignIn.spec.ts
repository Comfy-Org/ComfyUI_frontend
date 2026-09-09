import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import type { WorkspaceStore } from '@e2e/types/globals'

/**
 * A second browser window signing in makes the first window run its *logout*
 * path: `clearAllWorkflowStorage()` deletes every draft, and the storage fence
 * raised alongside it (`prepareWorkflowLogoutTransition`) is never lowered, so
 * the first window stops persisting for the rest of its life. Nobody signed
 * out.
 *
 * Both windows live in one browser context, which is what a second window is:
 * shared localStorage, separate sessionStorage. A sign-in in the second window
 * briefly replaces Firebase's shared auth persistence, and the first window's
 * SDK observes the transient null before the same user returns.
 *
 * `onUserLogout` (`useCurrentUser.ts:43`) fires on `prevUser && !user` — it
 * cannot distinguish that blip from a real sign-out.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const BOOT_FEATURES = {} satisfies RemoteConfig
const BOOT_SETTINGS = {
  'Comfy.TutorialCompleted': true,
  'Comfy.Workflow.Persist': true
}

async function bootWindow(page: Page): Promise<void> {
  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: BOOT_SETTINGS
  })
  await bootCloud(page)
  await page.goto(APP_URL)
  await waitForCloudApp(page)
  await page.waitForFunction(
    () =>
      !!(window.app!.extensionManager as WorkspaceStore).workflow.activeWorkflow
        ?.activeState
  )
}

/**
 * Mutates the graph and fires the event the persistence composable listens on
 * (`api.addEventListener('graphChanged', debouncedPersist)`). Touching `extra`
 * changes the serialized JSON, so `persistCurrentWorkflow`'s unchanged-payload
 * check does not skip the write.
 */
async function touchGraph(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const app = window.app!
    const graph = app.rootGraph
    const e2eTouch = crypto.randomUUID()
    graph.extra = { ...graph.extra, e2eTouch }

    const { activeWorkflow } = (app.extensionManager as WorkspaceStore).workflow
    const activeState = activeWorkflow?.activeState
    if (!activeState) throw new Error('no active workflow to persist')

    app.api.dispatchCustomEvent('graphChanged', activeState)
    return e2eTouch
  })
}

function localKeys(page: Page, prefix: string): Promise<string[]> {
  return page.evaluate((keyPrefix) => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(keyPrefix)) keys.push(key)
    }
    return keys.sort()
  }, prefix)
}

function hasPersistedTouch(page: Page, e2eTouch: string): Promise<boolean> {
  return page.evaluate((expectedTouch) => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('Comfy.Workflow.Draft.v2:')) continue

      const rawPayload = localStorage.getItem(key)
      if (!rawPayload) continue

      const payload: unknown = JSON.parse(rawPayload)
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('data' in payload) ||
        typeof payload.data !== 'string'
      )
        continue

      const graph: unknown = JSON.parse(payload.data)
      if (
        typeof graph === 'object' &&
        graph !== null &&
        'extra' in graph &&
        typeof graph.extra === 'object' &&
        graph.extra !== null &&
        'e2eTouch' in graph.extra &&
        graph.extra.e2eTouch === expectedTouch
      )
        return true
    }

    return false
  }, e2eTouch)
}

async function removeSharedFirebaseAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith('firebase:authUser:')
    )
    if (!key || !localStorage.getItem(key)) {
      throw new Error('no shared Firebase auth record')
    }

    localStorage.removeItem(key)
  })
}

test.describe('workflow drafts across windows', { tag: '@cloud' }, () => {
  test('a second window signing in neither wipes drafts nor stops persistence', async ({
    page
  }) => {
    await bootWindow(page)

    const initialTouch = await touchGraph(page)
    await expect.poll(() => hasPersistedTouch(page, initialTouch)).toBe(true)

    const draftsBefore = await localKeys(page, 'Comfy.Workflow.Draft.v2:')

    const secondWindow = await page.context().newPage()
    await bootWindow(secondWindow)

    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('Comfy.Workspace.Current')
      )
    ).not.toBeNull()

    await removeSharedFirebaseAuth(secondWindow)

    // Precondition, not the assertion under test: the first window must
    // actually observe the auth change, which it signals by tearing down its
    // workspace context. Without this the run proves nothing, so fail loudly
    // rather than pass vacuously.
    await expect
      .poll(
        () =>
          page.evaluate(
            () => sessionStorage.getItem('Comfy.Workspace.Current') === null
          ),
        {
          message:
            "first window never observed the second window's auth change - repro harness needs work, not a passing build"
        }
      )
      .toBe(true)

    await expect(
      page.getByRole('button', { name: 'Logout (E2E Test User)' })
    ).toBeVisible()

    expect
      .soft(
        await localKeys(page, 'Comfy.Workflow.Draft.v2:'),
        'drafts were wiped by a transient auth change in another window'
      )
      .toEqual(draftsBefore)

    const touchAfterAuthChange = await touchGraph(page)
    await expect
      .poll(() => hasPersistedTouch(page, touchAfterAuthChange), {
        message:
          'persistence stayed fenced after the auth change - the logout transition was never completed'
      })
      .toBe(true)
  })
})
