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
 */
import { readFileSync } from 'node:fs'

import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import { getMimeType } from '@e2e/fixtures/utils/mimeTypeUtil'
import { assetPath } from '@e2e/fixtures/utils/paths'

const test = mergeTests(comfyPageFixture, jobsRouteFixture)

const videoBytes = readFileSync(assetPath('plain_video.mp4'))

/** `getAssetCardByName` matches rendered text, and cards label themselves with
 * the base name — passing the full filename here finds nothing. */
const videoBaseNames = [
  'output_video-a',
  'output_video-b',
  'output_video-c'
] as const

const videoFileNames: readonly string[] = videoBaseNames.map(
  (baseName) => `${baseName}.mp4`
)

/**
 * Staggered timestamps pin the newest-first grid order to a → b → c, which the
 * shift-click range assertion below depends on.
 */
const videoJobs = videoFileNames.map((filename, index) =>
  createRouteMockJob({
    id: `video-${'abc'[index]}`,
    create_time: routeMockJobTimestamp - index * 1_000,
    execution_start_time: routeMockJobTimestamp - index * 1_000,
    execution_end_time: routeMockJobTimestamp,
    preview_output: {
      filename,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'video'
    }
  })
)

async function mockVideoViewFiles(page: Page) {
  await page.route('**/api/view**', async (route) => {
    if (route.request().method().toUpperCase() !== 'GET') {
      await route.fallback()
      return
    }

    const filename = new URL(route.request().url()).searchParams.get('filename')
    if (!filename || !videoFileNames.includes(filename)) {
      await route.fulfill({
        status: 404,
        json: { error: `Unknown filename: ${filename}` }
      })
      return
    }

    await route.fulfill({
      body: videoBytes,
      contentType: getMimeType(filename)
    })
  })
}

test.describe('Video asset multi-selection', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage, jobsRoutes, page }) => {
    await jobsRoutes.mockJobsQueue([])
    await jobsRoutes.mockJobsHistory(videoJobs)
    await comfyPage.assets.mockInputFiles([])
    await mockVideoViewFiles(page)
  })

  test('shift-click and Ctrl/Cmd-click build a multi-selection of video assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await tab.open()

    const [videoA, videoB, videoC] = videoBaseNames.map((baseName) =>
      tab.getAssetCardByName(baseName)
    )
    await expect(videoA).toBeVisible()
    await expect(videoC).toBeVisible()

    // The guard the modifier paths exist for: an unmodified click plays the
    // clip instead of selecting it.
    await videoA.click()
    await expect(tab.selectedCards).toHaveCount(0)

    // Ctrl/Cmd-click selects a video and sets the range anchor. A plain click
    // cannot do this on video, so it is also how the range below is seeded.
    await videoA.click({ modifiers: ['ControlOrMeta'] })

    await expect(tab.selectionCountButton).toHaveText(/\b1 selected\b/)
    await expect(tab.selectedCards).toHaveCount(1)

    await videoC.click({ modifiers: ['Shift'] })

    await expect(tab.selectionCountButton).toHaveText(/\b3 selected\b/)
    await expect(tab.selectedCards).toHaveCount(3)

    await videoB.click({ modifiers: ['ControlOrMeta'] })

    await expect(tab.selectionCountButton).toHaveText(/\b2 selected\b/)
    await expect(tab.selectedCards).toHaveCount(2)
    await expect(videoB).toHaveAttribute('data-selected', 'false')

    await expect(tab.deleteSelectedButton).toBeVisible()
    await expect(tab.downloadSelectedButton).toBeVisible()
  })
})
