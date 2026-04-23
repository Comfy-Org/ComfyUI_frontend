import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { NodeTemplatesHelper } from '@e2e/fixtures/helpers/NodeTemplatesHelper'
import { UserDataHelper } from '@e2e/fixtures/helpers/UserDataHelper'

export const nodeTemplatesFixture = comfyPageFixture.extend<{
  nodeTemplates: NodeTemplatesHelper
}>({
  nodeTemplates: async ({ comfyPage }, use) => {
    const userData = new UserDataHelper(
      comfyPage.request,
      comfyPage.id,
      comfyPage.url
    )
    const helper = new NodeTemplatesHelper(comfyPage, userData)
    await helper.reset()
    await use(helper)
  }
})
