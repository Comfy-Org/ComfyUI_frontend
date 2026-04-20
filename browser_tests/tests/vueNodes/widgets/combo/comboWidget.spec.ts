import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { TestGraphAccess } from '@e2e/types/globals'

test.describe('Vue Combo Widget', { tag: '@vue-nodes' }, () => {
  test('opens a dropdown that lists sampler options', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const samplerCombo = comfyPage.vueNodes
      .getNodeByTitle('KSampler')
      .getByRole('combobox', { name: 'sampler_name', exact: true })

    await samplerCombo.click()

    // The option list should include at least a few known samplers
    await expect(
      comfyPage.page.getByRole('option', { name: 'euler', exact: true })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('option', { name: 'dpmpp_2m', exact: true })
    ).toBeVisible()
  })

  test('updates the combo value after a new option is selected', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    await comfyPage.vueNodes.selectComboOption(
      'KSampler',
      'sampler_name',
      'dpmpp_2m'
    )

    const samplerCombo = comfyPage.vueNodes
      .getNodeByTitle('KSampler')
      .getByRole('combobox', { name: 'sampler_name', exact: true })

    await expect(samplerCombo).toContainText('dpmpp_2m')
  })

  test('persists the selected combo value in the serialized workflow', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    await comfyPage.vueNodes.selectComboOption(
      'KSampler',
      'scheduler',
      'karras'
    )

    const schedulerValue = await comfyPage.page.evaluate(() => {
      const graph = window.graph as unknown as TestGraphAccess | undefined
      if (!graph) return null
      const node = Object.values(graph._nodes_by_id).find(
        (n) => n.type === 'KSampler'
      )
      return node?.widgets?.find((w) => w.name === 'scheduler')?.value ?? null
    })

    expect(schedulerValue).toBe('karras')
  })
})
