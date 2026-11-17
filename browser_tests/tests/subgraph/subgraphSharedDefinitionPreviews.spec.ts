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
      const exposedPreviewSrcs = (hostId: string) =>
        comfyPage.vueNodes
          .getNodeLocator(hostId)
          .getByTestId(`node-body-${hostId}`)
          .locator('.image-preview img')
          .evaluateAll((images) =>
            images.map((image) => image.getAttribute('src'))
          )

      await comfyPage.runButton.click()

      await expect
        .poll(
          async () => [
            await exposedPreviewSrcs('5'),
            await exposedPreviewSrcs('6')
          ],
          { timeout: 30_000 }
        )
        .toEqual([
          [expect.stringMatching(/hostA_\d+_/)],
          [expect.stringMatching(/hostB_\d+_/)]
        ])
    })
  }
)
