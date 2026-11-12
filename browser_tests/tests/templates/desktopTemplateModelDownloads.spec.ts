import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { expect, mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { desktopModelDownloadFixture } from '@e2e/fixtures/desktopModelDownloadFixture'
import type { ModelDownloadHost } from '@e2e/fixtures/desktopModelDownloadFixture'
import {
  cleanupFakeModel,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(desktopModelDownloadFixture, templateApiFixture)

const TEMPLATE = 'two-missing-models'
const WORKFLOW = 'missing/missing_models_distinct'
const MODEL_URL = 'http://localhost:8188/api/devtools/fake_model.safetensors'
const MODEL_A = 'fake_model_a.safetensors'
const MODEL_B = 'fake_model_b.safetensors'

function runningDownload(filename: string): ComfyDownloadProgress {
  return {
    id: `canvas-${filename}`,
    url: MODEL_URL,
    filename,
    directory: 'checkpoints',
    status: 'downloading',
    progress: 0.25,
    receivedBytes: 256 * 1024 * 1024,
    totalBytes: 1024 * 1024 * 1024
  }
}

async function startOnCanvas(
  comfyPage: ComfyPage,
  modelDownloadHost: ModelDownloadHost,
  filenames: readonly string[]
) {
  await loadWorkflowAndOpenErrorsTab(comfyPage, WORKFLOW)
  for (const filename of filenames) {
    await modelDownloadHost.emitProgress(runningDownload(filename))
  }
}

async function openTemplateDetail(comfyPage: ComfyPage) {
  await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
  await expect(comfyPage.templates.content).toBeVisible()
  await comfyPage.templates.selectTemplate(TEMPLATE)
  return comfyPage.page.getByRole('article', { name: TEMPLATE })
}

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
        withTemplates([makeTemplate({ name: TEMPLATE, title: TEMPLATE })])
      )
      await templateApi.mock()
      await templateApi.mockWorkflow(
        TEMPLATE,
        `browser_tests/assets/${WORKFLOW}.json`
      )
    })

    test('shows progress and offers only opening when every model is already downloading', async ({
      comfyPage,
      modelDownloadHost
    }) => {
      await startOnCanvas(comfyPage, modelDownloadHost, [MODEL_A, MODEL_B])

      const detail = await openTemplateDetail(comfyPage)

      for (const filename of [MODEL_A, MODEL_B]) {
        await expect(
          detail.getByRole('progressbar', { name: `Downloading ${filename}` })
        ).toBeVisible()
      }
      await expect(
        detail.getByRole('button', { name: /^Download assets & open/ })
      ).toBeHidden()
      await detail
        .getByRole('button', { name: 'Just open', exact: true })
        .click()

      await expect(detail).toBeHidden()
      expect(await modelDownloadHost.downloads()).toEqual([])
    })

    test('requests only the model not yet downloading', async ({
      comfyPage,
      modelDownloadHost
    }) => {
      await startOnCanvas(comfyPage, modelDownloadHost, [MODEL_A])

      const detail = await openTemplateDetail(comfyPage)

      await expect(
        detail.getByRole('progressbar', { name: `Downloading ${MODEL_A}` })
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
          { url: MODEL_URL, filename: MODEL_B, directory: 'checkpoints' }
        ])
    })
  }
)
