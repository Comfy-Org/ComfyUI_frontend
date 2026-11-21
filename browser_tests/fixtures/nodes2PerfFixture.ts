import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { Nodes2PerfHelper } from '@e2e/fixtures/helpers/Nodes2PerfHelper'

export const nodes2PerfFixture = comfyPageFixture.extend<{
  nodes2Perf: Nodes2PerfHelper
}>({
  nodes2Perf: async ({ comfyPage }, use) => {
    const helper = new Nodes2PerfHelper(comfyPage)
    await helper.uploadPreviewImage()
    await use(helper)
  }
})
