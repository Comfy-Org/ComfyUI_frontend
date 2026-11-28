import { expect } from '@playwright/test'

import {
  NEWEST_PAGED_ASSET_ID,
  pagedAssetPosition,
  pagedAssetsFixture as test
} from '@e2e/fixtures/pagedAssetsFixture'

// Sorting does not scroll the grid back to the top, so this spec does not
// assert that it does: measured offset stayed at 1503px after a sort change,
// and there is no scroll reset in the assets sidebar to do it. Raised on the
// pull request rather than pinned here, because either expectation would
// encode a product decision this spec cannot make.
test.describe('Assets sidebar - sort while paging', { tag: '@cloud' }, () => {
  test('Changing sort while scrolled partway down re-sorts the list and keeps paging', async ({
    comfyPage,
    pagedAssets
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const firstRenderedId = () =>
      tab.assetCards.first().getAttribute('data-asset-id')

    // Positions of the rendered cards within the source list. Ascending means
    // the grid is showing newest-first, descending means oldest-first — a
    // statement about order alone, true at any scroll offset, which the id of
    // the first card cannot express without also claiming a scroll position.
    const renderedPositions = async () =>
      (await tab.renderedAssetIds()).map(pagedAssetPosition)

    const isStrictlyAscending = (values: number[]) =>
      values.every((value, i) => i === 0 || value > values[i - 1])

    await test.step('Default order heads with the newest asset', async () => {
      await expect.poll(firstRenderedId).toBe(NEWEST_PAGED_ASSET_ID)
      await expect.poll(() => tab.assetGridScrollTop()).toBe(0)
    })

    await test.step('Scroll down until the grid no longer renders the top of the list', async () => {
      await expect
        .poll(
          async () => {
            await tab.scrollAssetGridDown()
            return firstRenderedId()
          },
          { timeout: 20_000 }
        )
        .not.toBe(NEWEST_PAGED_ASSET_ID)

      await expect.poll(() => tab.assetGridScrollTop()).toBeGreaterThan(0)
    })

    // Guards the "keeps paging" assertion: if scrolling had already reached the
    // end of the list, nothing further could be fetched and that assertion
    // would pass for a list that stopped paging entirely.
    const servedBeforeSort = pagedAssets.furthestServed()
    expect(pagedAssets.canPageFurther()).toBe(true)

    await test.step('The grid is showing newest-first before the sort changes', async () => {
      const positions = await renderedPositions()
      // A single rendered card is trivially both ascending and descending.
      expect(positions.length).toBeGreaterThan(1)
      expect(isStrictlyAscending(positions)).toBe(true)
    })

    await test.step('Changing the sort order re-sorts the list while scrolled', async () => {
      await tab.openSettingsMenu()
      await tab.sortOldestFirst.click()

      await expect
        .poll(async () => {
          const positions = await renderedPositions()
          return (
            positions.length > 1 &&
            isStrictlyAscending([...positions].reverse())
          )
        })
        .toBe(true)
    })

    await test.step('The re-sorted list continues to page in more items', async () => {
      await expect
        .poll(
          async () => {
            await tab.scrollAssetGridDown()
            return pagedAssets.furthestServed()
          },
          { timeout: 20_000 }
        )
        .toBeGreaterThan(servedBeforeSort)
    })
  })
})
