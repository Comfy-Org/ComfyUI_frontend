import { randomUUID } from 'node:crypto'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { Nodes2PerfHelper } from '@e2e/fixtures/helpers/Nodes2PerfHelper'

export const nodes2PerfFixture = comfyPageFixture.extend<{
  nodes2Perf: Nodes2PerfHelper
}>({
  nodes2Perf: async ({ comfyPage, comfyFiles }, use) => {
    const previewImage = `nodes2-acceptance-perf-${randomUUID()}.png`
    comfyFiles.deleteAfterTest({ filename: previewImage, type: 'input' })
    const helper = new Nodes2PerfHelper(comfyPage, previewImage)
    await helper.uploadPreviewImage()
    await use(helper)
  }
})
