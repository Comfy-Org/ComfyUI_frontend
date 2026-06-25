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
    await expect(tab.selectionCountButton).toHaveText(/Assets Selected:\s*1\b/)
    await expect(tab.deleteSelectedButton).toBeVisible()
    await expect(tab.downloadSelectedButton).toBeVisible()

    await comfyPage.page.keyboard.down('Control')
    await tab.getAssetCardByName('beta').click()
    await comfyPage.page.keyboard.up('Control')

    await expect(tab.selectionCountButton).toHaveText(/Assets Selected:\s*2\b/)
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
