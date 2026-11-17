import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Subgraph shared-definition exposed previews',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('Each host shows the output its own instance produced', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-save-image'
      )
      const exposedPreview = (hostId: string) =>
        comfyPage.vueNodes
          .getNodeLocator(hostId)
          .getByTestId(`node-body-${hostId}`)
          .locator('.image-preview img')

      await comfyPage.runButton.click()

      await expect(exposedPreview('5')).toHaveAttribute('src', /hostA_\d+_/, {
        timeout: 30_000
      })
      await expect(exposedPreview('6')).toHaveAttribute('src', /hostB_\d+_/, {
        timeout: 30_000
      })
    })
  }
)
