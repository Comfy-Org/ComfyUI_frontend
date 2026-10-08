import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const ATTACHMENT_COUNT = 36

// Regression: https://linear.app/comfyorg/issue/FE-3202
test.describe('Agent composer bulk attachments', { tag: '@cloud' }, () => {
  test('keeps a visible send path and a reachable chip list after attaching dozens of images', async ({
    agentPanel,
    comfyPage,
    postedMessages
  }) => {
    const page = comfyPage.page
    // Each attachment ref is the upload response name, so a shared name would
    // make the POST assertion below pass on one ref echoed 36 times. Unique
    // names are what let it distinguish that from 36 refs actually travelling.
    const uploadedRefs: string[] = []
    await page.route('**/api/upload/image', (route) => {
      const name = `reference-${uploadedRefs.length + 1}.png`
      const uploaded: UploadImageResponse = {
        name,
        subfolder: '',
        type: 'input'
      }
      uploadedRefs.push(name)
      return route.fulfill(jsonRoute(uploaded))
    })

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.composer.fill('Compare these references')
    await agentPanel.fileInput.setInputFiles(
      Array.from({ length: ATTACHMENT_COUNT }, (_, index) => ({
        name: `reference-${index + 1}.png`,
        mimeType: 'image/png',
        buffer: Buffer.from(`reference-${index + 1}`)
      }))
    )

    await expect(agentPanel.attachmentChips).toHaveCount(ATTACHMENT_COUNT)
    await expect(agentPanel.attachmentChips.last()).not.toBeInViewport({
      ratio: 1
    })
    await agentPanel.scrollAssetsToEnd()
    await expect(agentPanel.attachmentChips.last()).toBeInViewport({ ratio: 1 })
    await expect(agentPanel.sendButton).toBeEnabled()
    // ratio: 1 rather than the default ratio: 0 — a Send button clipped down to
    // a sliver is the FE-3202 symptom, and it satisfies ratio: 0.
    await expect(agentPanel.sendButton).toBeInViewport({ ratio: 1 })

    // The cap is only a fix if what it hides stays reachable: `overflow-hidden`
    // in its place strands 32 of the 36 chips yet satisfies every other
    // assertion here, so this scrolls to the last chip rather than asserting a
    // class. The baseline keeps the wheel the only thing that can move the list.
    const scrollTop = () =>
      agentPanel.composerAssetSection.evaluate((element) => element.scrollTop)
    await expect.poll(scrollTop).toBe(0)
    await agentPanel.composerAssetSection.hover()
    await page.mouse.wheel(0, 2000)
    await expect.poll(scrollTop).toBeGreaterThan(0)
    await expect(
      agentPanel.attachmentChip(`reference-${ATTACHMENT_COUNT}.png`)
    ).toBeInViewport({ ratio: 1 })

    // Click, not Enter: the keyboard path posts even when the button has been
    // pushed out of reach, so only a real click proves Send is usable.
    await agentPanel.sendButton.click()
    await expect.poll(() => postedMessages.length).toBe(1)

    expect(uploadedRefs).toHaveLength(ATTACHMENT_COUNT)
    const postedAttachments: string[] = JSON.parse(
      postedMessages[0]
    ).attachments
    expect(postedAttachments).toHaveLength(ATTACHMENT_COUNT)
    expect(postedAttachments).toEqual(expect.arrayContaining(uploadedRefs))
  })
})
