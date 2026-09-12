import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Legacy widget persistence',
  { tag: ['@widget', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('preserves a non-default combo selection after save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')
      const [ksampler] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      if (!ksampler) throw new Error('KSampler node not found')
      const scheduler = await ksampler.getWidgetByName('scheduler')

      await scheduler.click()
      await comfyPage.page
        .getByRole('menuitem', { name: 'karras', exact: true })
        .click()
      await expect.poll(() => scheduler.getValue()).toBe('karras')
      await comfyPage.menu.topbar.saveWorkflow('legacy-combo-persistence')

      await comfyPage.workflow.reloadAndWaitForApp()

      const [reloadedKsampler] =
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      if (!reloadedKsampler) throw new Error('Reloaded KSampler node not found')
      await expect
        .poll(async () =>
          (await reloadedKsampler.getWidgetByName('scheduler')).getValue()
        )
        .toBe('karras')
    })

    test('preserves exact multiline paragraphs after save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/multiline_single_node')
      const paragraphs =
        'First paragraph: [subject] & café.\n\nSecond paragraph: <end> #100%.'
      const textarea = comfyPage.page.getByRole('textbox', {
        name: 'text',
        exact: true
      })
      await textarea.fill(paragraphs)
      await expect(textarea).toHaveValue(paragraphs)
      await comfyPage.menu.topbar.saveWorkflow('legacy-multiline-persistence')

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(
        comfyPage.page.getByRole('textbox', { name: 'text', exact: true })
      ).toHaveValue(paragraphs)
      const node = await comfyPage.nodeOps.getNodeRefById(1)
      await expect
        .poll(async () => (await node.getWidgetByName('text')).getValue())
        .toBe(paragraphs)
    })
  }
)
