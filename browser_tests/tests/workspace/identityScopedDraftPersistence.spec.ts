import {
  expect,
  identityScopedDraftFixture as test
} from '@e2e/fixtures/identityScopedDraftFixture'
import type { Page } from '@playwright/test'

const DRAFT_KEY = 'legacy-draft'
const DRAFT_PATH = 'workflows/Legacy.json'

test.describe('identity-scoped workflow drafts', { tag: '@cloud' }, () => {
  test('writes draft changes only to the signed-in identity scope', async ({
    identityDraft
  }) => {
    await identityDraft.boot()

    const marker = await identityDraft.touchGraph()
    await identityDraft.waitForMarker(identityDraft.scope, marker)

    const keys = await identityDraft.readStorage([
      `Comfy.Workflow.DraftIndex.v2:${identityDraft.scope}`,
      `Comfy.Workflow.DraftIndex.v2:${identityDraft.workspaceId}`
    ])
    expect(
      keys[`Comfy.Workflow.DraftIndex.v2:${identityDraft.scope}`]
    ).not.toBe(null)
    expect(
      keys[`Comfy.Workflow.DraftIndex.v2:${identityDraft.workspaceId}`]
    ).toBe(null)
  })

  test('removes departing drafts and blocks a pending write after logout', async ({
    identityDraft
  }) => {
    await identityDraft.boot()
    const initialMarker = await identityDraft.touchGraph()
    await identityDraft.waitForMarker(identityDraft.scope, initialMarker)

    await identityDraft.touchGraph()
    await identityDraft.logout()

    const prefix = `Comfy.Workflow.Draft.v2:${identityDraft.scope}:`
    const scopedDrafts = await identityDraft.readStorage([
      `Comfy.Workflow.DraftIndex.v2:${identityDraft.scope}`
    ])
    expect(
      scopedDrafts[`Comfy.Workflow.DraftIndex.v2:${identityDraft.scope}`]
    ).toBe(null)
    expect(
      (await identityDraft.readStorageKeys()).some((key) =>
        key.startsWith(prefix)
      )
    ).toBe(false)
  })

  test('migrates a legacy workspace draft once without clobbering it on reload', async ({
    identityDraft,
    page
  }) => {
    const updatedAt = Date.now() - 1_000
    const legacyIndex = JSON.stringify({
      v: 2,
      updatedAt,
      order: [DRAFT_KEY],
      entries: {
        [DRAFT_KEY]: {
          path: DRAFT_PATH,
          name: 'Legacy',
          isTemporary: true,
          updatedAt
        }
      }
    })
    const legacyPayload = JSON.stringify({
      data: JSON.stringify({ version: 0.4, nodes: [], links: [] }),
      updatedAt
    })
    const sourceIndexKey = `Comfy.Workflow.DraftIndex.v2:${identityDraft.workspaceId}`
    const sourcePayloadKey = `Comfy.Workflow.Draft.v2:${identityDraft.workspaceId}:${DRAFT_KEY}`
    const destinationIndexKey = `Comfy.Workflow.DraftIndex.v2:${identityDraft.scope}`
    const destinationPayloadKey = `Comfy.Workflow.Draft.v2:${identityDraft.scope}:${DRAFT_KEY}`
    const completionKey = `Comfy.Workflow.MigrationCompletion:${identityDraft.workspaceId}`

    await identityDraft.seedStorage({
      [sourceIndexKey]: legacyIndex,
      [sourcePayloadKey]: legacyPayload
    })
    await identityDraft.boot()

    await expect
      .poll(() =>
        identityDraft.readStorage([
          sourceIndexKey,
          sourcePayloadKey,
          destinationIndexKey,
          destinationPayloadKey,
          completionKey
        ])
      )
      .toMatchObject({
        [sourceIndexKey]: null,
        [sourcePayloadKey]: null,
        [destinationPayloadKey]: legacyPayload
      })

    const beforeReload = await identityDraft.readStorage([
      destinationPayloadKey,
      completionKey
    ])
    const migratedIndex = await identityDraft.readStorage([destinationIndexKey])
    expect(migratedIndex[destinationIndexKey]).toContain(DRAFT_KEY)
    expect(beforeReload[completionKey]).not.toBeNull()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForApp(page)

    expect(
      await identityDraft.readStorage([destinationPayloadKey, completionKey])
    ).toEqual(beforeReload)
  })
})

async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.app?.extensionManager)
}
