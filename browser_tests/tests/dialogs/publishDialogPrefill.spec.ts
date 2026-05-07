import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { PublishDialog } from '@e2e/fixtures/components/PublishDialog'

import { publishFixture as test } from '@e2e/fixtures/helpers/PublishApiHelper'

const PUBLISH_FEATURE_FLAGS = {
  comfyhub_upload_enabled: true,
  comfyhub_profile_gate_enabled: true
} as const

const PUBLISHED_SHARE_ID = 'prefill-share-id-1'
const PUBLISHED_WORKFLOW_NAME = 'Cinematic Upscale'
const PUBLISHED_DESCRIPTION = 'A polished cinematic upscale workflow.'
const PUBLISHED_THUMBNAIL_URL = 'https://cdn.example.com/thumb.png'
const PUBLISHED_SAMPLE_URL = 'https://cdn.example.com/sample-1.png'
const PUBLISHED_TUTORIAL_URL = 'https://www.youtube.com/watch?v=demo'

async function saveAndOpenPublishDialog(
  comfyPage: ComfyPage,
  dialog: PublishDialog,
  workflowName: string
): Promise<void> {
  await comfyPage.menu.topbar.saveWorkflow(workflowName)
  const overwriteDialog = comfyPage.page.locator(
    '.p-dialog:has-text("Overwrite")'
  )
  try {
    await overwriteDialog.waitFor({ state: 'visible', timeout: 500 })
    await comfyPage.confirmDialog.click('overwrite')
  } catch {
    /* no-op when the workflow name is unique */
  }
  await dialog.open()
}

test.describe('Publish dialog - prefill on republish', () => {
  test.beforeEach(async ({ comfyPage, publishApi }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks({ hasProfile: true })
    await publishApi.mockPublishStatus({
      workflow_id: 'wf-prefill-1',
      share_id: PUBLISHED_SHARE_ID,
      publish_time: '2026-04-01T12:00:00Z',
      listed: true,
      assets: []
    })
    await publishApi.mockHubWorkflowDetail(PUBLISHED_SHARE_ID, {
      name: PUBLISHED_WORKFLOW_NAME,
      description: PUBLISHED_DESCRIPTION,
      tags: [
        { name: 'anime', display_name: 'anime' },
        { name: 'upscale', display_name: 'upscale' }
      ],
      models: [{ name: 'sdxl', display_name: 'SDXL' }],
      custom_nodes: [],
      thumbnail_type: 'image',
      thumbnail_url: PUBLISHED_THUMBNAIL_URL,
      sample_image_urls: [PUBLISHED_SAMPLE_URL],
      tutorial_url: PUBLISHED_TUTORIAL_URL,
      metadata: {}
    })
  })

  test('prefills name and description from existing hub workflow', async ({
    comfyPage,
    publishDialog
  }) => {
    await saveAndOpenPublishDialog(
      comfyPage,
      publishDialog,
      'test-prefill-describe'
    )

    await expect(publishDialog.nameInput).toHaveValue(PUBLISHED_WORKFLOW_NAME)
    await expect(publishDialog.descriptionTextarea).toHaveValue(
      PUBLISHED_DESCRIPTION
    )
  })

  test('prefills the thumbnail preview from existing hub workflow', async ({
    comfyPage,
    publishDialog
  }) => {
    await saveAndOpenPublishDialog(
      comfyPage,
      publishDialog,
      'test-prefill-thumb'
    )
    await publishDialog.goNext()

    const thumbnailPreview =
      publishDialog.root.getByAltText('Thumbnail preview')
    await expect(thumbnailPreview).toBeVisible()
    await expect(thumbnailPreview).toHaveAttribute(
      'src',
      PUBLISHED_THUMBNAIL_URL
    )
  })

  test('prefills example images from existing hub workflow', async ({
    comfyPage,
    publishDialog
  }) => {
    await saveAndOpenPublishDialog(
      comfyPage,
      publishDialog,
      'test-prefill-examples'
    )
    await publishDialog.goNext()

    const sampleImage = publishDialog.root.locator(
      `img[src="${PUBLISHED_SAMPLE_URL}"]`
    )
    await expect(sampleImage).toBeVisible()
  })
})
