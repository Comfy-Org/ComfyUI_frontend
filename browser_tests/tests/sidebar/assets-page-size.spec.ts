import type { ListAssetsResponse } from '@comfyorg/ingest-types'
import {
  assetApiFixture,
  assetRequestIncludesTag
} from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { withOutputAssets } from '@e2e/fixtures/helpers/AssetHelper'
import { expect, mergeTests } from '@playwright/test'

/**
 * The page size `useAssetsQuery` pins. Asserted as a literal rather than
 * imported: the constant is module-private, and a test that reads it would
 * pass for any value it happened to hold.
 */
const PINNED_PAGE_SIZE = 20

/** More than two pages, so a second chunk is a strict subset of the store. */
const SEEDED_OUTPUTS = 45

type AssetsCall = { url: URL; ids: string[] }

const test = mergeTests(comfyPageFixture, assetApiFixture).extend<{
  assetsCalls: AssetsCall[]
}>({
  // Auto, so the listener is attached before `comfyPage` boots the app. The
  // generated feed fetches its first page during setup wherever the assets
  // flag is already on, which a listener registered in the test body misses —
  // and then the FIRST call the test sees is a later refetch, not page one.
  assetsCalls: [
    async ({ page }, use) => {
      const calls: AssetsCall[] = []
      page.on('response', (response) => {
        const url = new URL(response.url())
        if (!url.pathname.endsWith('/api/assets')) return
        // Recorded before the body resolves so an unreadable body still leaves
        // the request itself observable.
        const call: AssetsCall = { url, ids: [] }
        calls.push(call)
        void response
          .json()
          .then((body: ListAssetsResponse) => {
            call.ids = body.assets.map((asset) => asset.id)
          })
          .catch(() => {})
      })
      await use(calls)
    },
    { auto: true }
  ]
})

/**
 * The Imported feed hits the same endpoint, so every assertion here narrows to
 * the generated feed by tag rather than by arrival order.
 */
const generatedCalls = (calls: AssetsCall[]) =>
  calls.filter((call) => assetRequestIncludesTag(call.url.href, 'output'))

const firstPages = (calls: AssetsCall[]) =>
  generatedCalls(calls).filter((call) => !call.url.searchParams.get('after'))

const cursorPages = (calls: AssetsCall[]) =>
  generatedCalls(calls).filter((call) => call.url.searchParams.get('after'))

test.describe('Assets sidebar - page size', () => {
  test.use({
    modelLibraryOptions: { operators: [withOutputAssets(SEEDED_OUTPUTS)] },
    initialLocalStorage: { 'unified-sidebar': '[43, 57]' }
  })

  test('requests the pinned page size for the generated feed', async ({
    assetApi: _,
    assetsCalls,
    comfyPage
  }) => {
    await comfyPage.featureFlags.setServerFlagsPersistent({ assets: true })
    await comfyPage.menu.assetsTab.open()

    await expect
      .poll(() => generatedCalls(assetsCalls).length)
      .toBeGreaterThan(0)
    expect(
      new Set(
        generatedCalls(assetsCalls).map((call) =>
          call.url.searchParams.get('limit')
        )
      )
    ).toEqual(new Set([String(PINNED_PAGE_SIZE)]))
  })

  test('pages past the first chunk by cursor', async ({
    assetApi: _,
    assetsCalls,
    comfyPage
  }) => {
    await comfyPage.featureFlags.setServerFlagsPersistent({ assets: true })
    await comfyPage.menu.assetsTab.open()

    // Capped at the pinned size even though the store holds 45, which is what
    // shows the limit reached the server and was applied.
    await expect
      .poll(() => firstPages(assetsCalls).at(-1)?.ids.length)
      .toBe(PINNED_PAGE_SIZE)
    // The last uncursored page is the one whose `next_cursor` the feed threads
    // into `after`; the flag flip can produce an earlier, superseded one.
    const firstPage = firstPages(assetsCalls).at(-1)!

    // Twenty rows already overflow the panel, so the feed stops until the user
    // reaches the end of what is loaded. Scrolling there asks for the next page.
    await comfyPage.menu.assetsTab.contentPanel.hover()
    await comfyPage.page.mouse.wheel(0, 6000)

    await expect.poll(() => cursorPages(assetsCalls).length).toBeGreaterThan(0)
    const followUp = cursorPages(assetsCalls)[0]

    // An `after` the mock cannot find silently re-serves page one, so pin the
    // cursor to page one's last id and require the rows to be new ones.
    expect(followUp.url.searchParams.get('after')).toBe(firstPage.ids.at(-1))
    expect(followUp.url.searchParams.get('limit')).toBe(
      String(PINNED_PAGE_SIZE)
    )
    await expect.poll(() => followUp.ids.length).toBe(PINNED_PAGE_SIZE)
    expect(followUp.ids.filter((id) => firstPage.ids.includes(id))).toEqual([])
  })
})
