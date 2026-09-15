import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { NodeTemplatesHelper } from '@e2e/fixtures/helpers/NodeTemplatesHelper'

export const nodeTemplatesFixture = comfyPageFixture.extend<{
  nodeTemplates: NodeTemplatesHelper
}>({
  resetUserDataFiles: ['comfy.templates.json'],
  nodeTemplates: async ({ comfyPage }, use) => {
    await use(new NodeTemplatesHelper(comfyPage))
  }
})
