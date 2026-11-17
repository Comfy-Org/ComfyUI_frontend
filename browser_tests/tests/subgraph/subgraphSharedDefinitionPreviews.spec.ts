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
      const exposedPreviewSrcsByHost = () =>
        comfyPage.page
          .getByTestId(/^node-body-[56]$/)
          .evaluateAll((bodies) =>
            Object.fromEntries(
              bodies.map((body) => [
                body.dataset.testid,
                Array.from(
                  body.querySelectorAll('.image-preview img'),
                  (image) => image.getAttribute('src')
                )
              ])
            )
          )

      await comfyPage.runButton.click()

      await expect.poll(exposedPreviewSrcsByHost, { timeout: 30_000 }).toEqual({
        'node-body-5': [expect.stringMatching(/hostA_\d+_/)],
        'node-body-6': [expect.stringMatching(/hostB_\d+_/)]
      })
    })
  }
)
