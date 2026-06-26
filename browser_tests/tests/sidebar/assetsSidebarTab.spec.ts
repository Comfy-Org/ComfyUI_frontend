import { expect, mergeTests } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import type {
  JobDetail,
  RawJobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'

const test = mergeTests(comfyPageFixture, jobsRouteFixture)

interface ViewFile {
  body?: Buffer | string
  contentType?: string
}

type ViewFilesByName = Readonly<Record<string, ViewFile>>

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwPIRwAAAABJRU5ErkJggg==',
  'base64'
)

const alphaJob = createRouteMockJob({
  id: 'alpha',
  create_time: routeMockJobTimestamp - 1_000,
  execution_start_time: routeMockJobTimestamp - 1_000,
  execution_end_time: routeMockJobTimestamp,
  preview_output: {
    filename: 'alpha.png',
    subfolder: '',
    type: 'output',
    nodeId: '1',
    mediaType: 'images'
  }
})

const betaJob = createRouteMockJob({
  id: 'beta',
  create_time: routeMockJobTimestamp - 2_000,
  execution_start_time: routeMockJobTimestamp - 2_000,
  execution_end_time: routeMockJobTimestamp,
  preview_output: {
    filename: 'beta.png',
    subfolder: '',
    type: 'output',
    nodeId: '2',
    mediaType: 'images'
  }
})

const multiOutputJob = createRouteMockJob({
  id: 'multi-output',
  create_time: routeMockJobTimestamp - 3_000,
  execution_start_time: routeMockJobTimestamp - 3_000,
  execution_end_time: routeMockJobTimestamp,
  preview_output: {
    filename: 'multi-output-a.png',
    subfolder: '',
    type: 'output',
    nodeId: '3',
    mediaType: 'images'
  },
  outputs_count: 2
})

const multiOutputJobDetail: JobDetail = {
  ...multiOutputJob,
  outputs: {
    '3': {
      images: [
        {
          filename: 'multi-output-a.png',
          subfolder: '',
          type: 'output'
        },
        {
          filename: 'multi-output-b.png',
          subfolder: '',
          type: 'output'
        }
      ]
    }
  }
}

const generatedJobs: RawJobListItem[] = [alphaJob, betaJob]

const viewFiles = {
  'alpha.png': {},
  'beta.png': {},
  'imported.png': {},
  'multi-output-a.png': {},
  'multi-output-b.png': {}
}

function createGeneratedJobsFixture(count: number) {
  const files: Record<string, ViewFile> = {}
  const jobs = Array.from({ length: count }, (_, index) => {
    const id = `virtual-${String(index).padStart(2, '0')}`
    files[`output_${id}.png`] = {}
    return createRouteMockJob({
      id,
      create_time: routeMockJobTimestamp - 10_000 - index
    })
  })

  return { files, jobs }
}

async function mockInputFiles(page: Page, files: readonly string[]) {
  await page.route('**/internal/files/input**', async (route) => {
    if (route.request().method().toUpperCase() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({ json: [...files] })
  })
}

async function mockViewFiles(page: Page, filesByName: ViewFilesByName) {
  await page.route('**/api/view**', async (route) => {
    if (route.request().method().toUpperCase() !== 'GET') {
      await route.fallback()
      return
    }

    const url = new URL(route.request().url())
    const filename = url.searchParams.get('filename')
    if (!filename) {
      await route.fulfill({
        status: 400,
        json: { error: 'Missing filename' } satisfies { error: string }
      })
      return
    }

    const file = filesByName[filename]
    if (!file) {
      await route.fulfill({
        status: 404,
        json: {
          error: `Unknown filename: ${filename}`
        } satisfies { error: string }
      })
      return
    }

    await route.fulfill({
      body: file.body ?? transparentPng,
      contentType: file.contentType ?? 'image/png'
    })
  })
}

async function boundingBox(locator: Locator, label: string) {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`${label} must have a bounding box`)
  }

  return box
}

async function installSelectAllBubbleCounter(page: Page) {
  await page.evaluate(() => {
    const win = window as Window & { assetsCtrlAPropagationCount?: number }
    win.assetsCtrlAPropagationCount = 0
    window.addEventListener('keydown', (event) => {
      const isSelectAllShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a'

      if (isSelectAllShortcut) {
        win.assetsCtrlAPropagationCount =
          (win.assetsCtrlAPropagationCount ?? 0) + 1
      }
    })
  })
}

async function selectAllBubbleCount(page: Page) {
  return await page.evaluate(() => {
    const win = window as Window & { assetsCtrlAPropagationCount?: number }
    return win.assetsCtrlAPropagationCount ?? 0
  })
}

test.describe('FE-130 assets sidebar route mocks', () => {
  test.beforeEach(async ({ jobsRoutes, page }) => {
    await jobsRoutes.mockJobsQueue([])
    await jobsRoutes.mockJobsHistory(generatedJobs)
    await mockInputFiles(page, ['imported.png'])
    await mockViewFiles(page, viewFiles)
  })

  test('renders generated and imported assets with image previews', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()

    await expect(tab.getAssetCardByName('alpha')).toBeVisible()
    await expect(tab.getAssetCardByName('beta')).toBeVisible()
    await expect(
      comfyPage.page.getByRole('img', { name: 'alpha.png' })
    ).toHaveJSProperty('naturalWidth', 1)

    await tab.switchToImported()

    await expect(tab.getAssetCardByName('imported')).toBeVisible()
    await expect(
      comfyPage.page.getByRole('img', { name: 'imported.png' })
    ).toHaveJSProperty('naturalWidth', 1)
  })

  test('opens previews for generated and imported images', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()

    await comfyPage.page.getByRole('img', { name: 'alpha.png' }).dblclick()
    await expect(comfyPage.mediaLightbox.root).toBeVisible()
    await expect(
      comfyPage.mediaLightbox.root.getByRole('img', {
        name: 'alpha.png'
      })
    ).toBeVisible()

    await comfyPage.mediaLightbox.closeButton.click()
    await expect(comfyPage.mediaLightbox.root).toBeHidden()

    await tab.switchToImported()

    await comfyPage.page.getByRole('img', { name: 'imported.png' }).dblclick()
    await expect(comfyPage.mediaLightbox.root).toBeVisible()
    await expect(
      comfyPage.mediaLightbox.root.getByRole('img', {
        name: 'imported.png'
      })
    ).toBeVisible()
  })

  test('shows footer actions for single and multiple generated selections', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()

    await tab.getAssetCardByName('alpha').click()
    await expect(tab.selectionCountButton).toHaveText(/\b1 selected\b/)
    await expect(tab.deleteSelectedButton).toBeVisible()
    await expect(tab.downloadSelectedButton).toBeVisible()

    await comfyPage.page.keyboard.down('Control')
    await tab.getAssetCardByName('beta').click()
    await comfyPage.page.keyboard.up('Control')

    await expect(tab.selectionCountButton).toHaveText(/\b2 selected\b/)
    await expect(tab.deleteSelectedButton).toBeVisible()
    await expect(tab.downloadSelectedButton).toBeVisible()
  })

  test('marquee dragging from empty grid space selects intersected assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()
    await expect.poll(() => tab.assetCards.count()).toBeGreaterThanOrEqual(2)

    const surfaceBox = await boundingBox(tab.marqueeSurface, 'marquee surface')
    const secondCardBox = await boundingBox(
      tab.assetCards.nth(1),
      'second card'
    )

    await comfyPage.page.mouse.move(surfaceBox.x + 4, surfaceBox.y + 4)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(
      secondCardBox.x + secondCardBox.width - 4,
      secondCardBox.y + secondCardBox.height - 4,
      { steps: 8 }
    )
    await expect(tab.marqueeSelection).toBeVisible()
    await comfyPage.page.mouse.up()

    await expect(tab.selectedCards).toHaveCount(2)
  })

  test('plain dragging from an asset card does not marquee select', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()
    await expect.poll(() => tab.assetCards.count()).toBeGreaterThanOrEqual(1)

    const firstCardBox = await boundingBox(tab.assetCards.first(), 'first card')
    await comfyPage.page.mouse.move(
      firstCardBox.x + firstCardBox.width / 2,
      firstCardBox.y + firstCardBox.height / 2
    )
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(
      firstCardBox.x + firstCardBox.width / 2 + 40,
      firstCardBox.y + firstCardBox.height / 2 + 40,
      { steps: 8 }
    )

    await expect(tab.marqueeSelection).toBeHidden()
    await comfyPage.page.mouse.up()
    await expect(tab.selectedCards).toHaveCount(0)
  })

  test('marquee hit testing ignores virtualized buffer rows outside the panel', async ({
    comfyPage,
    jobsRoutes,
    page
  }) => {
    const tab = comfyPage.menu.assetsTab
    const virtualizedAssets = createGeneratedJobsFixture(30)

    await jobsRoutes.mockJobsHistory(virtualizedAssets.jobs)
    await mockViewFiles(page, virtualizedAssets.files)
    await comfyPage.setup()
    await tab.open()
    await expect.poll(() => tab.assetCards.count()).toBeGreaterThanOrEqual(1)

    const gridScroller = page.locator(
      '.sidebar-content-container .p-scrollpanel-content'
    )
    await gridScroller.evaluate((element) => {
      element.scrollTop = 500
      element.dispatchEvent(new Event('scroll'))
    })
    await expect
      .poll(() => gridScroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0)

    const surfaceBox = await boundingBox(tab.marqueeSurface, 'marquee surface')
    await comfyPage.page.mouse.move(surfaceBox.x + 4, surfaceBox.y + 4)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(
      surfaceBox.x + surfaceBox.width - 4,
      Math.max(surfaceBox.y - 80, 4),
      { steps: 8 }
    )
    await expect(tab.marqueeSelection).toBeVisible()
    await comfyPage.page.mouse.up()

    const selectedCardsIntersectPanel = await page.evaluate(() => {
      const surface = document.querySelector(
        '[data-testid="assets-marquee-surface"]'
      )
      if (!(surface instanceof HTMLElement)) {
        return []
      }

      const surfaceRect = surface.getBoundingClientRect()
      return Array.from(
        document.querySelectorAll('[data-selected="true"]')
      ).map((element) => {
        if (!(element instanceof HTMLElement)) {
          return false
        }

        const rect = element.getBoundingClientRect()
        return (
          rect.left < surfaceRect.right &&
          rect.right > surfaceRect.left &&
          rect.top < surfaceRect.bottom &&
          rect.bottom > surfaceRect.top
        )
      })
    })

    expect(selectedCardsIntersectPanel.length).toBeGreaterThan(0)
    expect(selectedCardsIntersectPanel).not.toContain(false)
  })

  test('Ctrl+dragging from an asset card starts marquee selection', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()
    await expect.poll(() => tab.assetCards.count()).toBeGreaterThanOrEqual(2)

    const firstCardBox = await boundingBox(tab.assetCards.first(), 'first card')
    const secondCardBox = await boundingBox(
      tab.assetCards.nth(1),
      'second card'
    )

    await comfyPage.page.keyboard.down('Control')
    try {
      await comfyPage.page.mouse.move(
        firstCardBox.x + firstCardBox.width / 2,
        firstCardBox.y + firstCardBox.height / 2
      )
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        secondCardBox.x + secondCardBox.width - 4,
        secondCardBox.y + secondCardBox.height - 4,
        { steps: 8 }
      )
      await expect(tab.marqueeSelection).toBeVisible()
      await comfyPage.page.mouse.up()
    } finally {
      await comfyPage.page.keyboard.up('Control')
    }

    await expect(tab.selectedCards).toHaveCount(2)
  })

  test('Ctrl+dragging within one asset card keeps marquee selection', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()

    const firstCard = tab.assetCards.first()
    const firstCardBox = await boundingBox(firstCard, 'first card')
    const start = {
      x: firstCardBox.x + firstCardBox.width / 2,
      y: firstCardBox.y + firstCardBox.height / 2
    }

    await comfyPage.page.keyboard.down('Control')
    try {
      await comfyPage.page.mouse.move(start.x, start.y)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(start.x + 12, start.y + 12, {
        steps: 4
      })
      await expect(tab.marqueeSelection).toBeVisible()
      await comfyPage.page.mouse.up()
    } finally {
      await comfyPage.page.keyboard.up('Control')
    }

    await expect(tab.selectedCards).toHaveCount(1)
    await expect(firstCard).toHaveAttribute('data-selected', 'true')
  })

  test('Ctrl+A selects assets while hovered', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()
    await expect.poll(() => tab.assetCards.count()).toBeGreaterThanOrEqual(1)

    const cardCount = await tab.assetCards.count()
    await tab.marqueeSurface.hover()
    await comfyPage.keyboard.selectAll(null)

    await expect(tab.selectedCards).toHaveCount(cardCount)
  })

  test('Ctrl+A in the focused search input does not select assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()
    await tab.searchInput.fill('alpha')
    await expect(tab.assetCards).toHaveCount(1)

    await tab.marqueeSurface.hover()
    await tab.searchInput.focus()
    await comfyPage.keyboard.selectAll(null)

    await expect(tab.selectedCards).toHaveCount(0)
    await expect
      .poll(() =>
        tab.searchInput.evaluate((element) => {
          if (!(element instanceof HTMLInputElement)) {
            throw new Error('Expected asset search input')
          }

          return {
            selectionEnd: element.selectionEnd,
            selectionStart: element.selectionStart,
            valueLength: element.value.length
          }
        })
      )
      .toEqual({
        selectionEnd: 5,
        selectionStart: 0,
        valueLength: 5
      })
  })

  test('marquee dragging from search through tabs does not select text', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()
    await tab.searchInput.fill('a')
    await expect(tab.assetCards).toHaveCount(2)

    await tab.searchInput.evaluate((element) => {
      if (!(element instanceof HTMLInputElement)) {
        throw new Error('Expected asset search input')
      }

      element.setSelectionRange(0, element.value.length)
    })

    const searchBox = await boundingBox(tab.searchInput, 'asset search input')
    const firstCardBox = await boundingBox(tab.assetCards.first(), 'first card')

    await comfyPage.page.mouse.move(
      searchBox.x + searchBox.width / 2,
      searchBox.y + searchBox.height / 2
    )
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(
      firstCardBox.x + firstCardBox.width - 8,
      firstCardBox.y + firstCardBox.height - 8,
      { steps: 10 }
    )
    await expect(tab.marqueeSelection).toBeVisible()
    await comfyPage.page.mouse.up()

    await expect.poll(() => tab.selectedCards.count()).toBeGreaterThanOrEqual(1)
    await expect
      .poll(() =>
        tab.searchInput.evaluate((element) => {
          if (!(element instanceof HTMLInputElement)) {
            throw new Error('Expected asset search input')
          }

          return {
            documentSelection: window.getSelection()?.toString() ?? '',
            selectionEnd: element.selectionEnd,
            selectionStart: element.selectionStart,
            valueLength: element.value.length
          }
        })
      )
      .toEqual({
        documentSelection: '',
        selectionEnd: 1,
        selectionStart: 1,
        valueLength: 1
      })
  })

  test('Ctrl+A while hovered does not bubble to global keybindings', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()
    await installSelectAllBubbleCounter(comfyPage.page)

    await comfyPage.canvas.click()
    await tab.marqueeSurface.hover()
    await comfyPage.keyboard.selectAll(null)

    await expect(tab.selectedCards).toHaveCount(await tab.assetCards.count())
    await expect.poll(() => selectAllBubbleCount(comfyPage.page)).toBe(0)
  })

  test('loads full generated job outputs from job detail', async ({
    comfyPage,
    jobsRoutes
  }) => {
    const tab = comfyPage.menu.assetsTab

    await jobsRoutes.mockJobsHistory([multiOutputJob])
    await jobsRoutes.mockJobDetail('multi-output', multiOutputJobDetail)

    await comfyPage.setup()
    await tab.open()

    await tab
      .getAssetCardByName('multi-output-a')
      .getByRole('button', { name: 'See more outputs' })
      .click()

    await expect(tab.backToAssetsButton).toBeVisible()
    await expect(tab.getAssetCardByName('multi-output-b')).toBeVisible()
    await expect(
      comfyPage.page.getByRole('img', { name: 'multi-output-b.png' })
    ).toHaveJSProperty('naturalWidth', 1)
  })

  test('deletes a generated output asset through explicit history refresh', async ({
    comfyPage,
    jobsRoutes
  }) => {
    const tab = comfyPage.menu.assetsTab

    await comfyPage.setup()
    await tab.open()
    await expect(tab.getAssetCardByName('alpha')).toBeVisible()

    const deleteRequests = await jobsRoutes.mockDeleteHistory()
    await jobsRoutes.mockJobsHistory([betaJob])

    await tab.getAssetCardByName('alpha').click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()
    await comfyPage.confirmDialog.delete.click()

    await expect.poll(() => deleteRequests).toHaveLength(1)
    expect(deleteRequests[0]).toEqual({ delete: ['alpha'] })
    await expect(tab.getAssetCardByName('alpha')).toHaveCount(0)
    await expect(comfyPage.toast.toastSuccesses).toContainText(
      'Asset deleted successfully'
    )
  })
})
