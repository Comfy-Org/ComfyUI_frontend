/**
 * QA test plan "cloud 1.50 → 1.51", Asset Management (#14347, #14765, #14848,
 * #14858): shift-click and Ctrl/Cmd-click must multi-select video assets the
 * same way they already do for image assets.
 *
 * Video is the one media kind that needs its own coverage here. A plain click
 * on a video card is deliberately swallowed — `MediaAssetCard.handlePreviewClick`
 * returns early for `fileKind === 'video'` so the click plays the clip instead
 * of selecting it — and that early return is skipped only while a selection
 * modifier is held. The modifier paths are therefore the *only* way to build a
 * multi-selection on video, and a regression in that guard would silently make
 * video assets unselectable while images kept working.
 *
 * Scope: this spec pins that video-only guard, not the range/replace semantics
 * of `useAssetSelection.handleAssetClick` — those are media-agnostic and are
 * pinned at the unit level in `useAssetSelection.test.ts` and
 * `useAssetSelection.property.test.ts`. The fourth video below sits outside the
 * a → c range so the shift step cannot be satisfied by a "select all" or an
 * "add the clicked card" regression.
 */
import { readFileSync } from 'node:fs'

import { expect, mergeTests } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import { getMimeType } from '@e2e/fixtures/utils/mimeTypeUtil'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

const test = mergeTests(comfyPageFixture, jobsRouteFixture)

const videoBytes = readFileSync(assetPath('plain_video.mp4'))

/** `getAssetCardByName` matches rendered text, and cards label themselves with
 * the base name — passing the full filename here finds nothing. */
const videoBaseNames = [
  'output_video-a',
  'output_video-b',
  'output_video-c',
  'output_video-d'
] as const

const videoFileNames: readonly string[] = videoBaseNames.map(
  (baseName) => `${baseName}.mp4`
)

const videoViewFiles = Object.fromEntries(
  videoFileNames.map((filename) => [
    filename,
    { body: videoBytes, contentType: getMimeType(filename) }
  ])
)

/**
 * Staggered timestamps pin the newest-first grid order to a → b → c → d, which
 * the shift-click range assertions below depend on.
 */
const videoJobs = videoBaseNames.map((baseName, index) =>
  createRouteMockJob({
    id: `video-${baseName.slice(-1)}`,
    create_time: routeMockJobTimestamp - index * 1_000,
    execution_start_time: routeMockJobTimestamp - index * 1_000,
    execution_end_time: routeMockJobTimestamp,
    preview_output: {
      filename: videoFileNames[index],
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'video'
    }
  })
)

test.describe('Video asset multi-selection', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage, jobsRoutes, page }) => {
    await jobsRoutes.mockJobsQueue([])
    await jobsRoutes.mockJobsHistory(videoJobs)
    await comfyPage.assets.mockInputFiles([])
    await mockViewFiles(page, videoViewFiles)
  })

  test('shift-click and Ctrl/Cmd-click build a multi-selection of video assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await tab.open()

    const [videoA, videoB, videoC, videoD] = videoBaseNames.map((baseName) =>
      tab.getAssetCardByName(baseName)
    )
    // All four videos are in the grid before anything is selected. This is what
    // makes the counts below load-bearing: `d` exists, so a count of 3 is a
    // statement that `d` was left out rather than that it was never there.
    await expect(tab.assetCards).toHaveCount(4)
    for (const card of [videoA, videoB, videoC, videoD]) {
      await expect(card).toBeVisible()
      await expect(card).toHaveAttribute('data-selected', 'false')
    }

    /**
     * Pins the exact selected set.
     *
     * `selectionCountButton` is the authoritative check for what is *not*
     * selected: it renders the store's count over all four assets, whereas
     * `data-selected` can only speak for cards the virtual grid currently
     * renders — and the selection footer shrinks the grid enough to unmount the
     * last row, so `d` is absent from the DOM whenever anything is selected.
     * Store count === rendered selected count === the named cards therefore
     * pins the set closed without asserting on an unmounted card.
     */
    const expectSelected = async (...selectedCards: readonly Locator[]) => {
      await expect(tab.selectionCountButton).toHaveText(
        new RegExp(`\\b${selectedCards.length} selected\\b`)
      )
      await expect(tab.selectedCards).toHaveCount(selectedCards.length)
      for (const card of selectedCards) {
        await expect(card).toHaveAttribute('data-selected', 'true')
      }
    }

    // The guard the modifier paths exist for: an unmodified click plays the
    // clip instead of selecting it.
    await videoA.click()
    await expect(tab.selectedCards).toHaveCount(0)
    await expect(tab.selectionCountButton).toBeHidden()

    // Ctrl/Cmd-click selects a video and sets the range anchor. A plain click
    // cannot do this on video, so it is also how the range below is seeded.
    await videoA.click({ modifiers: ['ControlOrMeta'] })

    await expectSelected(videoA)

    // Shift-click extends the selection from the anchor to the clicked card.
    // `d` stays unselected, so this cannot be satisfied by a regression that
    // selects everything (4) or that only adds the clicked card (2).
    await videoC.click({ modifiers: ['Shift'] })

    await expectSelected(videoA, videoB, videoC)

    // Ctrl/Cmd-click toggles a single video back off without disturbing the rest.
    await videoB.click({ modifiers: ['ControlOrMeta'] })

    await expectSelected(videoA, videoC)
    await expect(videoB).toHaveAttribute('data-selected', 'false')

    await expect(tab.deleteSelectedButton).toBeVisible()
    await expect(tab.downloadSelectedButton).toBeVisible()
  })
})
