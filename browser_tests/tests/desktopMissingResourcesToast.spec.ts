import { expect, mergeTests } from '@playwright/test'

import {
  canvasDownload,
  twoMissingModelsTemplate as workflow
} from '@e2e/fixtures/data/desktopModelDownloads'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { desktopModelDownloadFixture as test } from '@e2e/fixtures/desktopModelDownloadFixture'
import { cleanupFakeModel } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { untrackedDesktopHostFixture } from '@e2e/fixtures/untrackedDesktopHostFixture'
import { TestIds } from '@e2e/fixtures/selectors'

const GATED_MODEL_URL =
  'https://huggingface.co/comfy-e2e/gated-test/resolve/main/gated_model.safetensors'

test.describe('Desktop missing resources toast', { tag: '@desktop' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await cleanupFakeModel(comfyPage)
  })

  test('downloads every missing model from the toast', async ({
    comfyPage,
    modelDownloadHost
  }) => {
    await comfyPage.workflow.loadWorkflow(workflow.workflow)
    const toast = comfyPage.page.getByTestId(TestIds.toast.panel)
    await expect(toast).toContainText('This workflow needs 2 models')

    await toast.getByRole('button', { name: /^Download all/ }).click()

    await expect
      .poll(() => modelDownloadHost.downloads())
      .toEqual([
        {
          url: workflow.modelUrl,
          filename: workflow.modelA,
          directory: 'checkpoints'
        },
        {
          url: workflow.modelUrl,
          filename: workflow.modelB,
          directory: 'checkpoints'
        }
      ])
  })

  test('sums only the running downloads and offers the rest', async ({
    comfyPage,
    modelDownloadHost
  }) => {
    await comfyPage.workflow.loadWorkflow(workflow.workflow)
    const toast = comfyPage.page.getByTestId(TestIds.toast.panel)
    await expect(toast).toContainText('This workflow needs 2 models')

    await modelDownloadHost.emitProgress(canvasDownload(workflow.modelA))

    await expect(toast).toContainText('Downloading models')
    await expect(toast).toContainText('256 MB / 1 GB (0 of 1)')
    await expect(
      toast.getByRole('button', { name: /^Download 1 more/ })
    ).toBeVisible()
  })

  test('pauses and cancels a running download from its row', async ({
    comfyPage,
    modelDownloadHost
  }) => {
    await comfyPage.workflow.loadWorkflow(workflow.workflow)
    const toast = comfyPage.page.getByTestId(TestIds.toast.panel)
    await expect(toast).toContainText('This workflow needs 2 models')
    await modelDownloadHost.emitProgress(canvasDownload(workflow.modelA))
    await toast.getByRole('button', { name: 'Show model downloads' }).click()

    await toast
      .getByRole('button', {
        name: `Pause download for ${workflow.modelA}`
      })
      .click()
    await toast
      .getByRole('button', {
        name: `Cancel download for ${workflow.modelA}`
      })
      .click()

    await expect
      .poll(() => modelDownloadHost.controls())
      .toEqual([
        { action: 'pause', ref: `canvas-${workflow.modelA}` },
        { action: 'cancel', ref: `canvas-${workflow.modelA}` }
      ])
  })

  test.describe('with gated and URL-less models', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page
        .context()
        .route('https://huggingface.co/**', async (route) =>
          route.fulfill({
            status: 403,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Expose-Headers': 'X-Error-Code',
              'X-Error-Code': 'GatedRepo'
            }
          })
        )
    })

    test('opens expanded with a notice when models are gated or have no download URL', async ({
      comfyPage,
      modelDownloadHost
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'missing/missing_models_gated_and_unlisted'
      )
      const toast = comfyPage.page.getByTestId(TestIds.toast.panel)

      await expect(
        toast.getByRole('button', { name: 'Hide model downloads' })
      ).toHaveAttribute('aria-expanded', 'true')
      await expect(toast.getByRole('note')).toContainText(
        "Some models can't be downloaded automatically or need access on Hugging Face."
      )
      await expect(
        toast.getByRole('list', { name: 'Missing models' })
      ).toContainText('No download URL')
      await expect(
        toast.getByRole('button', {
          name: /^Open Hugging Face repository for gated_model\.safetensors/
        })
      ).toBeVisible()

      await toast.getByRole('button', { name: /^Download all/ }).click()

      await expect
        .poll(() => modelDownloadHost.downloads())
        .toEqual([
          {
            url: GATED_MODEL_URL,
            filename: 'gated_model.safetensors',
            directory: 'checkpoints'
          }
        ])
    })
  })
})

comfyPageFixture.describe('Missing resources toast outside Desktop', () => {
  comfyPageFixture.use({
    initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true }
  })

  comfyPageFixture(
    'leaves missing models to the error overlay',
    async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
      await comfyPage.workflow.loadWorkflow(workflow.workflow)
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeVisible()

      await expect(comfyPage.page.getByTestId(TestIds.toast.panel)).toBeHidden()
    }
  )
})

const untrackedDesktopHost = mergeTests(
  comfyPageFixture,
  untrackedDesktopHostFixture
)

untrackedDesktopHost.describe(
  'Missing resources toast on a Desktop host that does not report download progress',
  { tag: '@desktop' },
  () => {
    untrackedDesktopHost.use({
      initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true }
    })

    untrackedDesktopHost(
      'leaves missing models to the error overlay',
      async ({ comfyPage }) => {
        await cleanupFakeModel(comfyPage)
        await comfyPage.workflow.loadWorkflow(workflow.workflow)
        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
        ).toBeVisible()

        await expect(
          comfyPage.page.getByTestId(TestIds.toast.panel)
        ).toBeHidden()
      }
    )
  }
)
