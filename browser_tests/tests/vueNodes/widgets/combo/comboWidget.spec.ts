import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

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

  test('persists the selected combo value across a serialize and reload round-trip', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    await comfyPage.vueNodes.selectComboOption(
      'KSampler',
      'scheduler',
      'karras'
    )

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    await comfyPage.workflow.loadGraphData(serialized)
    await comfyPage.vueNodes.waitForNodes()

    const [ksamplerNode] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
    if (!ksamplerNode) {
      throw new Error('KSampler node not found after reload')
    }

    const schedulerWidget = await ksamplerNode.getWidgetByName('scheduler')
    await expect.poll(() => schedulerWidget.getValue()).toBe('karras')

    const schedulerComboAfterReload = comfyPage.vueNodes
      .getNodeByTitle('KSampler')
      .getByRole('combobox', { name: 'scheduler', exact: true })
    await expect(schedulerComboAfterReload).toContainText('karras')
  })
})
