import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'CRT Fancy Timer live serialized properties',
  { tag: '@node' },
  () => {
    test('opening a workflow whose node serializes its live properties keeps them', async ({
      comfyPage
    }) => {
      const { topbar } = comfyPage.menu

      await comfyPage.workflow.loadWorkflow('nodes/fancy_timer')

      await expect(
        topbar.getWorkflowTab('fancy_timer').and(topbar.getActiveTab())
      ).toBeVisible()
      await expect
        .poll(
          async () =>
            (await comfyPage.workflow.getExportedWorkflow()).nodes[0].properties
        )
        .toMatchObject({ elapsed: '00:01:000' })
    })
  }
)
