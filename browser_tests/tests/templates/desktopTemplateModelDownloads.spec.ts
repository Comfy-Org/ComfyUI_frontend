import { expect, mergeTests } from '@playwright/test'

import {
  canvasDownload,
  twoMissingModelsTemplate as template
} from '@e2e/fixtures/data/desktopModelDownloads'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { desktopModelDownloadFixture } from '@e2e/fixtures/desktopModelDownloadFixture'
import {
  cleanupFakeModel,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(desktopModelDownloadFixture, templateApiFixture)

test.describe(
  'Desktop template model downloads started elsewhere',
  { tag: '@desktop' },
  () => {
    test.use({
      initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true }
    })

    test.beforeEach(async ({ comfyPage, templateApi }) => {
      await cleanupFakeModel(comfyPage)
      templateApi.configure(
        withTemplates([
          makeTemplate({ name: template.name, title: template.name })
        ])
      )
      await templateApi.mock()
      await templateApi.mockWorkflow(
        template.name,
        `browser_tests/assets/${template.workflow}.json`
      )
      await loadWorkflowAndOpenErrorsTab(comfyPage, template.workflow)
    })

    test('shows progress and offers only opening when every model is already downloading', async ({
      comfyPage,
      modelDownloadHost,
      templateApi
    }) => {
      await modelDownloadHost.emitProgress(canvasDownload(template.modelA))
      await modelDownloadHost.emitProgress(canvasDownload(template.modelB))

      await templateApi.load(template.name)
      const detail = comfyPage.templates.detail(template.name)

      await expect(
        detail.getByRole('progressbar', {
          name: `Downloading ${template.modelA}`
        })
      ).toBeVisible()
      await expect(
        detail.getByRole('progressbar', {
          name: `Downloading ${template.modelB}`
        })
      ).toBeVisible()
      await expect(
        detail.getByRole('button', { name: /^Download assets & open/ })
      ).toBeHidden()
      await expect(
        detail.getByRole('button', { name: 'Just open', exact: true })
      ).toBeHidden()
      await detail.getByRole('button', { name: 'Open', exact: true }).click()

      await expect(detail).toBeHidden()
      expect(await modelDownloadHost.downloads()).toEqual([])
    })

    test('requests only the model not yet downloading', async ({
      comfyPage,
      modelDownloadHost,
      templateApi
    }) => {
      await modelDownloadHost.emitProgress(canvasDownload(template.modelA))

      await templateApi.load(template.name)
      const detail = comfyPage.templates.detail(template.name)

      await expect(
        detail.getByRole('progressbar', {
          name: `Downloading ${template.modelA}`
        })
      ).toBeVisible()
      await expect(
        detail.getByRole('button', { name: 'Just open', exact: true })
      ).toBeVisible()
      await detail
        .getByRole('button', { name: /^Download assets & open/ })
        .click()

      await expect
        .poll(() => modelDownloadHost.downloads())
        .toEqual([
          {
            url: template.modelUrl,
            filename: template.modelB,
            directory: 'checkpoints'
          }
        ])
      await expect(detail).toBeHidden()
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toContain(template.name)
    })

    test('resumes a paused model instead of requesting it again', async ({
      comfyPage,
      modelDownloadHost,
      templateApi
    }) => {
      await modelDownloadHost.emitProgress(
        canvasDownload(template.modelA, { status: 'paused' })
      )
      await modelDownloadHost.emitProgress(canvasDownload(template.modelB))

      await templateApi.load(template.name)
      const detail = comfyPage.templates.detail(template.name)

      await expect(
        detail.getByRole('button', { name: 'Just open', exact: true })
      ).toBeVisible()
      await detail
        .getByRole('button', { name: /^Download assets & open/ })
        .click()

      await expect
        .poll(() => modelDownloadHost.controls())
        .toEqual([{ action: 'resume', ref: `canvas-${template.modelA}` }])
      expect(await modelDownloadHost.downloads()).toEqual([])
    })
  }
)
