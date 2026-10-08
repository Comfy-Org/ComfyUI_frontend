import type { ComfyTemplateInputAsset } from '@comfyorg/comfyui-desktop-bridge-types'
import { expect, mergeTests } from '@playwright/test'

import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { desktopTemplateInputsFixture } from '@e2e/fixtures/desktopTemplateInputsFixture'
import { withIndex, withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(desktopTemplateInputsFixture, templateApiFixture)

const OFFICIAL_TEMPLATE = 'desktop-inputs'
const CUSTOM_TEMPLATE = 'extension-inputs'
const WORKFLOW = 'browser_tests/assets/nodes/single_ksampler.json'
/** A LoadImage node bound to `bare_photo.png`, which no input folder holds. */
const WORKFLOW_MISSING_INPUT =
  'browser_tests/assets/missing/missing_media_bare_filename.json'
const MISSING_INPUT = 'bare_photo.png'

function missingAsset(): ComfyTemplateInputAsset {
  return {
    assetId: 'asset-a',
    filename: 'subject.png',
    mediaType: 'image',
    previewUrl: 'https://host.invalid/subject.png',
    availability: 'missing'
  }
}

test.describe('Desktop template input assets', { tag: '@desktop' }, () => {
  test('fetches a declared input for a first-party template', async ({
    comfyPage,
    templateApi,
    templateInputHost,
    seedTemplateInputs
  }) => {
    await seedTemplateInputs([
      { templateId: OFFICIAL_TEMPLATE, assets: [missingAsset()] }
    ])
    templateApi.configure(
      withTemplates([makeTemplate({ name: OFFICIAL_TEMPLATE })])
    )
    await templateApi.mock()
    await templateApi.mockWorkflow(OFFICIAL_TEMPLATE, WORKFLOW)

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templates.selectTemplate(OFFICIAL_TEMPLATE)

    await expect
      .poll(() => templateInputHost.lookups())
      .toContain(OFFICIAL_TEMPLATE)
    await expect
      .poll(() => templateInputHost.downloads())
      .toEqual([{ templateId: OFFICIAL_TEMPLATE, assetId: 'asset-a' }])
  })

  test('keeps the missing-media warning down while the input is fetched', async ({
    comfyPage,
    templateApi,
    templateInputHost,
    seedTemplateInputs
  }) => {
    await seedTemplateInputs([
      {
        templateId: OFFICIAL_TEMPLATE,
        assets: [{ ...missingAsset(), filename: MISSING_INPUT }]
      }
    ])
    templateApi.configure(
      withTemplates([makeTemplate({ name: OFFICIAL_TEMPLATE })])
    )
    await templateApi.mock()
    await templateApi.mockWorkflow(OFFICIAL_TEMPLATE, WORKFLOW_MISSING_INPUT)

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templates.selectTemplate(OFFICIAL_TEMPLATE)

    await expect.poll(() => templateInputHost.downloads()).toHaveLength(1)

    // The file is genuinely absent, so without the download in flight this is
    // the state that raises the warning.
    await templateInputHost.emitProgress({
      downloadId: 'job-asset-a',
      filename: MISSING_INPUT,
      progress: 0.4,
      status: 'downloading',
      templateInputs: [{ templateId: OFFICIAL_TEMPLATE, assetId: 'asset-a' }]
    })

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeHidden()
  })

  test('never asks the host about a template served by an extension', async ({
    comfyPage,
    templateApi,
    templateInputHost,
    seedTemplateInputs
  }) => {
    // Seeded exactly like the first-party case, so the only difference left is
    // the module the template is served under.
    await seedTemplateInputs([
      { templateId: CUSTOM_TEMPLATE, assets: [missingAsset()] }
    ])
    const template = makeTemplate({ name: CUSTOM_TEMPLATE })
    templateApi.configure(
      withTemplates([template]),
      withIndex([
        {
          moduleName: 'some-extension',
          title: 'Extension Templates',
          type: 'image',
          templates: [template]
        }
      ])
    )
    await templateApi.mock()
    // An extension's templates are served from the API, not the default
    // `/templates` path, so `mockWorkflow` would not reach this one.
    await comfyPage.page.route(
      `**/api/workflow_templates/some-extension/${CUSTOM_TEMPLATE}.json`,
      (route) => route.fulfill({ status: 200, path: WORKFLOW })
    )

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templates.selectTemplate(CUSTOM_TEMPLATE)

    // The workflow still opens; only the trusted download path is withheld.
    await comfyPage.nodeOps.waitForGraphNodes(1)
    expect(await templateInputHost.lookups()).toEqual([])
    expect(await templateInputHost.downloads()).toEqual([])
  })
})
