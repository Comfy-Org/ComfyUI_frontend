import { expect, mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

const IMAGE_SIZE = 200

function imageJob(id: string, filename: string, ageMs: number) {
  return createRouteMockJob({
    id,
    create_time: routeMockJobTimestamp - ageMs,
    execution_start_time: routeMockJobTimestamp - ageMs,
    execution_end_time: routeMockJobTimestamp,
    preview_output: {
      filename,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    }
  })
}

const jobs = [
  imageJob('zoom-a', 'zoom-a.png', 1_000),
  imageJob('zoom-b', 'zoom-b.png', 2_000)
]

const test = mergeTests(comfyPageFixture, jobsRouteFixture).extend<{
  mockImageJobs: void
}>({
  mockImageJobs: [
    async ({ jobsRoutes, page }, use) => {
      await jobsRoutes.mockJobsScenario({ history: jobs, queue: [] })
      await jobsRoutes.mockJobsHistory(jobs)
      await mockViewFiles(page, {
        'zoom-a.png': {
          path: 'browser_tests/assets/agent/asset-grid-repro-a.png'
        },
        'zoom-b.png': {
          path: 'browser_tests/assets/agent/asset-grid-repro-b.png'
        }
      })
      await use()
    },
    { auto: true }
  ]
})

async function openLightbox(comfyPage: ComfyPage) {
  await comfyPage.menu.assetsTab.open()
  await comfyPage.page.getByRole('img', { name: 'zoom-a.png' }).dblclick()
  const lightbox = comfyPage.mediaLightbox
  await expect(
    lightbox.root.getByRole('img', { name: 'zoom-a.png' })
  ).toHaveJSProperty('naturalWidth', IMAGE_SIZE)
  await expect(lightbox.zoomPercentage).toBeHidden()
  return lightbox
}

test.describe('Media lightbox image zoom', { tag: '@ui' }, () => {
  test('zooms in on wheel and shows the zoom level', async ({ comfyPage }) => {
    const lightbox = await openLightbox(comfyPage)

    await lightbox.wheelOverImage(-100)

    await expect(lightbox.zoomPercentage).toHaveText('110%')
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).width)
      .toBeCloseTo(IMAGE_SIZE * 1.1)
  })

  test('toggles between 2x and the fitted size on double-click', async ({
    comfyPage
  }) => {
    const lightbox = await openLightbox(comfyPage)

    await lightbox.zoomTarget.dblclick()
    await expect(lightbox.zoomPercentage).toHaveText('200%')
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).width)
      .toBeCloseTo(IMAGE_SIZE * 2)

    await lightbox.zoomTarget.dblclick()
    await expect(lightbox.zoomPercentage).toBeHidden()
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).width)
      .toBeCloseTo(IMAGE_SIZE)
  })

  test('pans a zoomed image and stays open when released over the background', async ({
    comfyPage
  }) => {
    const lightbox = await openLightbox(comfyPage)
    await lightbox.zoomTarget.dblclick()
    await expect(lightbox.zoomPercentage).toHaveText('200%')

    const before = await lightbox.zoomTargetBox()
    const start = await lightbox.zoomTargetCenter()
    const viewport = comfyPage.page.viewportSize()
    if (!viewport) throw new Error('Viewport size is not set')
    const end = { x: start.x, y: viewport.height - 5 }

    await comfyPage.page.mouse.move(start.x, start.y)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(end.x, end.y, { steps: 10 })
    await comfyPage.page.mouse.up()

    await expect(lightbox.root).toBeVisible()
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).y - before.y)
      .toBeCloseTo(end.y - start.y, 0)
  })

  test('resets the zoom when moving to the next image', async ({
    comfyPage
  }) => {
    const lightbox = await openLightbox(comfyPage)
    await lightbox.zoomTarget.dblclick()
    await expect(lightbox.zoomPercentage).toHaveText('200%')

    await lightbox.nextButton.click()

    await expect(
      lightbox.root.getByRole('img', { name: 'zoom-b.png' })
    ).toBeVisible()
    await expect(lightbox.zoomPercentage).toBeHidden()
    await expect
      .poll(async () => (await lightbox.zoomTargetBox()).width)
      .toBeCloseTo(IMAGE_SIZE)
  })
})
