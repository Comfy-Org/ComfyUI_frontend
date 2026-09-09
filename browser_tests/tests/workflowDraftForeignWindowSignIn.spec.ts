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
 * shared localStorage, separate sessionStorage. The second window clears
 * Firebase's shared auth persistence, which is what a real sign-in does to that
 * store, and the first window's SDK observes the transient null.
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

const FIREBASE_DB = 'firebaseLocalStorageDb'
const FIREBASE_STORE = 'firebaseLocalStorage'

async function bootWindow(page: Page): Promise<void> {
  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: BOOT_SETTINGS
  })
  await bootCloud(page)
  await page.goto(APP_URL)
  await waitForCloudApp(page)
}

/**
 * Mutates the graph and fires the event the persistence composable listens on
 * (`api.addEventListener('graphChanged', debouncedPersist)`). Touching `extra`
 * changes the serialized JSON, so `persistCurrentWorkflow`'s unchanged-payload
 * check does not skip the write.
 */
async function touchGraph(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.app!
    const graph = app.rootGraph
    graph.extra = { ...graph.extra, e2eTouch: performance.now() }

    const { activeWorkflow } = (app.extensionManager as WorkspaceStore).workflow
    const activeState = activeWorkflow?.activeState
    if (!activeState) throw new Error('no active workflow to persist')

    app.api.dispatchCustomEvent('graphChanged', activeState)
  })
}

function localKeys(page: Page, prefix: string): Promise<string[]> {
  return page.evaluate((keyPrefix) => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(keyPrefix)) keys.push(key)
    }
    return keys
  }, prefix)
}

async function draftIndexUpdatedAt(page: Page): Promise<number | null> {
  const [indexKey] = await localKeys(page, 'Comfy.Workflow.DraftIndex.v2:')
  if (!indexKey) return null
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' &&
      parsed !== null &&
      'updatedAt' in parsed &&
      typeof parsed.updatedAt === 'number'
      ? parsed.updatedAt
      : null
  }, indexKey)
}

/**
 * Drops Firebase's shared auth record, the way a sign-in in another window
 * replaces it. The first window's SDK reads the same IndexedDB.
 */
async function clearSharedFirebaseAuth(page: Page): Promise<void> {
  await page.evaluate(
    ([dbName, storeName]) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(storeName, 'readwrite')
          tx.objectStore(storeName).clear()
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
    [FIREBASE_DB, FIREBASE_STORE] as const
  )
}

test.describe('workflow drafts across windows', { tag: '@cloud' }, () => {
  test('a second window signing in neither wipes drafts nor stops persistence', async ({
    page
  }) => {
    await bootWindow(page)

    await touchGraph(page)
    await expect
      .poll(
        async () => (await localKeys(page, 'Comfy.Workflow.Draft.v2:')).length
      )
      .toBeGreaterThan(0)

    const draftsBefore = await localKeys(page, 'Comfy.Workflow.Draft.v2:')
    const indexBefore = await draftIndexUpdatedAt(page)
    expect(indexBefore).not.toBeNull()

    const secondWindow = await page.context().newPage()
    await bootWindow(secondWindow)
    await clearSharedFirebaseAuth(secondWindow)

    // Precondition, not the assertion under test: the first window must
    // actually observe the auth change, which it signals by tearing down its
    // workspace context. Without this the run proves nothing, so fail loudly
    // rather than pass vacuously.
    await expect
      .poll(
        async () =>
          (await localKeys(page, 'Comfy.Workspace.Current')).length === 0,
        {
          message:
            "first window never observed the second window's auth change - repro harness needs work, not a passing build"
        }
      )
      .toBe(true)

    expect(
      await localKeys(page, 'Comfy.Workflow.Draft.v2:'),
      'drafts were wiped by a transient auth change in another window'
    ).toEqual(draftsBefore)

    await touchGraph(page)
    await expect
      .poll(() => draftIndexUpdatedAt(page), {
        message:
          'persistence stayed fenced after the auth change - the logout transition was never completed'
      })
      .not.toBe(indexBefore)
  })
})
