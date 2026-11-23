import type { UploadImageResponse } from '@comfyorg/ingest-types'
import type { Page } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'
import {
  hasElementFlashed,
  trackElementFlash
} from '@e2e/fixtures/utils/flashDetector'

const test = mergeTests(comfyPageFixture, templateApiFixture)

const SAMPLE_TEMPLATE = 'web-samples'
const SAMPLE_TEMPLATE_TITLE = 'Web Sample Template'
const SAMPLE_FILE = 'nonexistent_test_image_12345.png'
const SAMPLE_HOST = 'https://raw.githubusercontent.com/**'
const UPLOAD_ROUTE = '**/upload/image'

async function loadImageValue(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      window.app!.graph.nodes.find((node) => node.type === 'LoadImage')
        ?.widgets?.[0]?.value
  )
}

test.describe('Web template routing', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ page, templateApi }) => {
    templateApi.configure(
      withTemplates([
        makeTemplate({
          name: 'web-direct',
          title: 'Web Direct Template'
        }),
        makeTemplate({
          name: SAMPLE_TEMPLATE,
          title: SAMPLE_TEMPLATE_TITLE,
          io: {
            inputs: [
              {
                nodeId: 10,
                nodeType: 'LoadImage',
                file: SAMPLE_FILE,
                mediaType: 'image',
                sourceRevision: '0123456789abcdef0123456789abcdef01234567'
              }
            ]
          }
        })
      ])
    )
    await templateApi.mock()
    await trackElementFlash(page, TestIds.templates.detail)
    await templateApi.mockWorkflow(
      'web-direct',
      'browser_tests/assets/nodes/single_ksampler.json'
    )
    await templateApi.mockWorkflow(
      SAMPLE_TEMPLATE,
      'browser_tests/assets/missing/missing_media_single.json'
    )
  })

  test('loads a template without presenting Template Detail', async ({
    comfyPage
  }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await comfyPage.templates.selectTemplate('web-direct')

    await expect(comfyPage.templates.content).toBeHidden()
    await comfyPage.nodeOps.waitForGraphNodes(1)
    expect(await comfyPage.nodeOps.getNodeRefsByType('KSampler')).toHaveLength(
      1
    )
    expect(
      await hasElementFlashed(comfyPage.page, TestIds.templates.detail)
    ).toBe(false)
  })

  test('just opens a template while its example media host never answers', async ({
    comfyPage
  }) => {
    const sampleRequests: string[] = []
    const uploads: string[] = []
    await comfyPage.page.route(SAMPLE_HOST, (route) => {
      sampleRequests.push(route.request().url())
    })
    await comfyPage.page.route(UPLOAD_ROUTE, async (route) => {
      uploads.push(route.request().url())
      await route.abort()
    })

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templates.selectTemplate(SAMPLE_TEMPLATE)
    await expect(
      comfyPage.templates.detail(SAMPLE_TEMPLATE_TITLE)
    ).toBeVisible()
    await comfyPage.page
      .getByRole('button', { name: 'Just open', exact: true })
      .click()

    await expect(comfyPage.templates.content).toBeHidden()
    await comfyPage.nodeOps.waitForGraphNodes(1)
    await expect.poll(() => loadImageValue(comfyPage.page)).toBe(SAMPLE_FILE)
    expect(sampleRequests).toEqual([])
    expect(uploads).toEqual([])
  })

  test('binds the uploaded example file after Download assets & open', async ({
    comfyPage
  }) => {
    const uploaded: UploadImageResponse = {
      name: 'renamed sample (1).png',
      subfolder: '',
      type: 'input'
    }
    await comfyPage.page.route(SAMPLE_HOST, (route) =>
      route.fulfill({ path: 'browser_tests/assets/example.webp' })
    )
    await comfyPage.page.route(UPLOAD_ROUTE, (route) =>
      route.fulfill({ status: 200, json: uploaded })
    )

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templates.selectTemplate(SAMPLE_TEMPLATE)
    await comfyPage.page
      .getByRole('button', { name: 'Download assets & open', exact: true })
      .click()

    await expect(comfyPage.templates.content).toBeHidden()
    await comfyPage.nodeOps.waitForGraphNodes(1)
    await expect.poll(() => loadImageValue(comfyPage.page)).toBe(uploaded.name)
  })
})
