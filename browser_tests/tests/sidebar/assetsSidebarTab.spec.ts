import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

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

test.describe('FE-910 marquee selection and select all', () => {
  test.beforeEach(async ({ jobsRoutes, page, comfyPage }) => {
    await jobsRoutes.mockJobsQueue([])
    await jobsRoutes.mockJobsHistory(generatedJobs)
    await mockInputFiles(page, ['imported.png'])
    await mockViewFiles(page, viewFiles)
    await comfyPage.setup()
    await comfyPage.menu.assetsTab.open()
  })

  test('Ctrl/Cmd+A selects every asset while the panel is hovered', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await expect(tab.assetCards).toHaveCount(2)

    await tab.getAssetCardByName('alpha').hover()
    await comfyPage.page.keyboard.press('ControlOrMeta+a')

    await expect(tab.selectedCards).toHaveCount(2)
  })

  test('a marquee that begins in the panel header selects the cards', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    const { page } = comfyPage

    await expect(tab.assetCards).toHaveCount(2)
    await expect(tab.selectedCards).toHaveCount(0)

    const header = await tab.panelHeader.boundingBox()
    const beta = await tab.getAssetCardByName('beta').boundingBox()
    if (!header || !beta) {
      throw new Error('panel header or asset card has no layout box')
    }

    // Begin the rubber-band in the header (above the grid), then drag down
    // across both cards.
    await page.mouse.move(header.x + 24, header.y + 20)
    await page.mouse.down()
    await page.mouse.move(beta.x + 8, beta.y + beta.height - 8, { steps: 14 })
    await page.mouse.up()

    await expect(tab.selectedCards).toHaveCount(2)
    await expect(tab.selectionFooter).toBeVisible()
  })

  test('Ctrl/Cmd+A leaves assets unselected while the canvas is hovered', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    const { page } = comfyPage

    await expect(tab.assetCards).toHaveCount(2)

    const viewport = page.viewportSize()
    if (!viewport) throw new Error('viewport size is unavailable')

    // Hover the canvas (not the panel); Ctrl/Cmd+A must yield to the canvas.
    await page.mouse.move(viewport.width - 100, viewport.height / 2)
    await page.keyboard.press('ControlOrMeta+a')

    await expect(tab.selectedCards).toHaveCount(0)
  })

  test('a modifier-held marquee adds to the existing selection', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    const { page } = comfyPage

    await expect(tab.assetCards).toHaveCount(2)

    await tab.getAssetCardByName('alpha').click()
    await expect(tab.selectedCards).toHaveCount(1)

    const beta = await tab.getAssetCardByName('beta').boundingBox()
    if (!beta) throw new Error('beta card has no layout box')

    // Hold a modifier so the marquee is additive, then rubber-band over beta.
    await page.keyboard.down('Control')
    await page.mouse.move(beta.x + 12, beta.y + 12)
    await page.mouse.down()
    await page.mouse.move(beta.x + beta.width - 12, beta.y + beta.height - 12, {
      steps: 12
    })
    await page.mouse.up()
    await page.keyboard.up('Control')

    await expect(tab.selectedCards).toHaveCount(2)
  })

  test('a Ctrl/Cmd+Shift marquee removes the covered cards from the selection', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    const { page } = comfyPage

    await expect(tab.assetCards).toHaveCount(2)

    await tab.getAssetCardByName('alpha').hover()
    await page.keyboard.press('ControlOrMeta+a')
    await expect(tab.selectedCards).toHaveCount(2)

    const beta = await tab.getAssetCardByName('beta').boundingBox()
    if (!beta) throw new Error('beta card has no layout box')

    // Ctrl+Shift makes the marquee subtractive: rubber-band over beta only.
    await page.keyboard.down('Control')
    await page.keyboard.down('Shift')
    await page.mouse.move(beta.x + 12, beta.y + 12)
    await page.mouse.down()
    await page.mouse.move(beta.x + beta.width - 12, beta.y + beta.height - 12, {
      steps: 12
    })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await page.keyboard.up('Control')

    await expect(tab.selectedCards).toHaveCount(1)
    await expect(tab.getAssetCardByName('alpha')).toHaveAttribute(
      'data-selected',
      'true'
    )
  })

  test('Ctrl/Cmd-dragging from an asset card starts a marquee selection', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    const { page } = comfyPage

    await expect(tab.assetCards).toHaveCount(2)
    await expect(tab.selectedCards).toHaveCount(0)

    const alpha = await tab.getAssetCardByName('alpha').boundingBox()
    const beta = await tab.getAssetCardByName('beta').boundingBox()
    if (!alpha || !beta) throw new Error('asset cards have no layout box')

    // Ctrl bypasses card drag, so a press that begins on a card rubber-bands.
    await page.keyboard.down('Control')
    await page.mouse.move(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2)
    await page.mouse.down()
    await page.mouse.move(beta.x + beta.width - 6, beta.y + beta.height - 6, {
      steps: 12
    })
    await page.mouse.up()
    await page.keyboard.up('Control')

    await expect(tab.selectedCards).toHaveCount(2)
    await expect(tab.selectionFooter).toBeVisible()
  })

  test('Ctrl/Cmd-dragging within a single card selects only that card', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    const { page } = comfyPage

    await expect(tab.assetCards).toHaveCount(2)

    const alpha = tab.getAssetCardByName('alpha')
    const box = await alpha.boundingBox()
    if (!box) throw new Error('alpha card has no layout box')

    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await page.keyboard.down('Control')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 12, start.y + 12, { steps: 4 })
    await page.mouse.up()
    await page.keyboard.up('Control')

    await expect(tab.selectedCards).toHaveCount(1)
    await expect(alpha).toHaveAttribute('data-selected', 'true')
  })

  test('Ctrl/Cmd+A in the focused search input does not select assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    const query = 'alpha'

    await tab.searchInput.fill(query)
    await expect(tab.assetCards).toHaveCount(1)

    await tab.searchInput.focus()
    await comfyPage.page.keyboard.press('ControlOrMeta+a')

    await expect(tab.selectedCards).toHaveCount(0)
    await expect
      .poll(() =>
        tab.searchInput.evaluate((el: HTMLInputElement) => {
          return { start: el.selectionStart, end: el.selectionEnd }
        })
      )
      .toEqual({ start: 0, end: query.length })
  })

  test('a drag starting in the search input does not marquee-select assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    const { page } = comfyPage

    await expect(tab.assetCards).toHaveCount(2)

    const search = await tab.searchInput.boundingBox()
    const beta = await tab.getAssetCardByName('beta').boundingBox()
    if (!search || !beta)
      throw new Error('search box or card has no layout box')

    await page.mouse.move(
      search.x + search.width / 2,
      search.y + search.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(beta.x + beta.width / 2, beta.y + beta.height / 2, {
      steps: 12
    })
    await page.mouse.up()

    await expect(tab.selectedCards).toHaveCount(0)
  })

  test('Ctrl/Cmd+A does not select assets while an aria-modal dialog is open', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await expect(tab.assetCards).toHaveCount(2)

    await comfyPage.page.evaluate(() => {
      const dialog = document.createElement('div')
      dialog.id = 'test-modal'
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-modal', 'true')
      document.body.appendChild(dialog)
    })

    await tab.getAssetCardByName('alpha').hover()
    await comfyPage.page.keyboard.press('ControlOrMeta+a')

    await expect(tab.selectedCards).toHaveCount(0)

    await comfyPage.page.evaluate(() => {
      document.getElementById('test-modal')?.remove()
    })
  })
})
