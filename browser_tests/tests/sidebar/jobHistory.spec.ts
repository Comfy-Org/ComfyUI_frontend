import type { Locator } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'
import type { JobEntry } from '@comfyorg/ingest-types'

import { assetScenarioFixture } from '@e2e/fixtures/assetScenarioFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/utils/jobFixtures'

const test = mergeTests(comfyPageFixture, assetScenarioFixture)

const HISTORY_JOBS: JobEntry[] = [
  createMockJob({
    id: 'job-completed-1',
    status: 'completed',
    create_time: 1_000_000,
    execution_start_time: 1_000_000,
    execution_end_time: 1_010_000,
    preview_output: {
      filename: 'history-completed.png',
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-failed-1',
    status: 'failed',
    create_time: 2_000_000,
    execution_start_time: 2_000_000,
    execution_end_time: 2_005_000,
    preview_output: {
      filename: 'history-failed.png',
      subfolder: '',
      type: 'output',
      nodeId: '2',
      mediaType: 'images'
    },
    outputs_count: 1
  })
]

async function openOverlayMenu(comfyPage: {
  page: {
    getByTestId(id: string): Locator
    getByLabel(label: string | RegExp): Locator
  }
}) {
  await comfyPage.page.getByTestId('queue-overlay-toggle').click()
  await comfyPage.page
    .getByLabel(/More options/i)
    .first()
    .click()
}

test.describe('Job history sidebar', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.mockGeneratedHistory(HISTORY_JOBS)
    await comfyPage.setupSettings({
      'Comfy.Queue.QPOV2': true
    })
    await comfyPage.setup()
  })

  test('shows seeded history and filters failed jobs', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.jobRow('job-completed-1')).toBeVisible()
    await expect(tab.jobRow('job-failed-1')).toBeVisible()

    await tab.failedTab.click()

    await expect(tab.jobRow('job-failed-1')).toBeVisible()
    await expect(tab.jobRow('job-completed-1')).toBeHidden()
  })

  test('opens the preview lightbox for completed jobs', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await tab.jobRow('job-completed-1').dblclick()

    await expect(comfyPage.mediaLightbox.root).toBeVisible()
  })

  test('clears history from the docked sidebar', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await tab.moreOptionsButton.click()
    await comfyPage.page.getByTestId('clear-history-action').click()

    await expect(comfyPage.confirmDialog.root).toBeVisible()
    await comfyPage.confirmDialog.root
      .getByRole('button', { name: 'Clear' })
      .click()

    await expect(tab.jobRows).toHaveCount(0)
  })

  test('disables clear queue when there are no queued jobs', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.clearQueuedButton).toBeDisabled()
  })
})

test.describe('Floating overlay dock to job history', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.mockGeneratedHistory(HISTORY_JOBS)
    await comfyPage.setupSettings({
      'Comfy.Queue.QPOV2': false
    })
    await comfyPage.setup()
  })

  test('opens the docked job history sidebar from the floating overlay', async ({
    comfyPage
  }) => {
    await openOverlayMenu(comfyPage)
    await comfyPage.page.getByTestId('docked-job-history-action').click()

    await expect(comfyPage.menu.jobHistoryTab.searchInput).toBeVisible()
    await expect(
      comfyPage.menu.jobHistoryTab.jobRow('job-completed-1')
    ).toBeVisible()
  })
})
