import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const HOW_TO_TEXT = 'Hello from the How-To packs'

test.describe(
  'Published API How-To packs',
  { tag: ['@node', '@widget'] },
  () => {
    test('register and exercise representative examples', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodeApi/how-to-examples')

      const workflow = await comfyPage.workflow.getExportedWorkflow()
      expect(workflow.nodes.map(({ type }) => type)).toEqual([
        'HowTo/ConstantText',
        'HowTo/Reroute',
        'HowToTextOutput',
        'HowTo/WidgetEvents',
        'HowTo/CanvasMeter',
        'HowTo/MountedSlider',
        'HowTo/LifecycleBadge',
        'HowTo/DropTextFile',
        'HowTo/GraphBuilder',
        'HowTo/BackendPing',
        'HowTo/BackendEvent',
        'HowTo/SettingsStorage',
        'HowToRating',
        'HowToTemplateText'
      ])
      expect(workflow.nodes[6].howToState).toBe('paused')

      const lifecycleBadge = await comfyPage.nodeOps.getNodeRefById(7)
      await lifecycleBadge.centerOnNode()
      expect(await lifecycleBadge.getContextMenuOptionNames()).toContain(
        'Resume'
      )
      await comfyPage.contextMenu.clickMenuItem('Resume')
      await comfyPage.contextMenu.waitForHidden()
      const resumedWorkflow = await comfyPage.workflow.getExportedWorkflow()
      expect(resumedWorkflow.nodes[6].howToState).toBe('ready')

      const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(Object.keys(prompt).sort()).toEqual(['13', '14', '3'])
      expect(prompt['3']).toEqual({
        inputs: { text: HOW_TO_TEXT },
        class_type: 'HowToTextOutput',
        _meta: { title: 'How-To: Text Output' }
      })
      expect(prompt['13']).toEqual({
        inputs: { rating: 3 },
        class_type: 'HowToRating',
        _meta: { title: 'How-To: Custom Rating Widget' }
      })
      expect(prompt['14'].inputs.text).toMatch(/^rendered-\d{4}-\d{2}-\d{2}$/)

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      const widgetEvents = await comfyPage.nodeOps.getNodeRefById(4)
      await widgetEvents.centerOnNode()
      await (await widgetEvents.getWidget(1)).click()
      await expect
        .poll(() => widgetEvents.getWidget(0).then((w) => w.getValue()))
        .toBe(1)

      const backendPing = await comfyPage.nodeOps.getNodeRefById(10)
      await backendPing.centerOnNode()
      await (await backendPing.getWidget(0)).click()
      await expect
        .poll(() => backendPing.getWidget(1).then((w) => w.getValue()))
        .toBe('Hello from Python')

      const backendEvent = await comfyPage.nodeOps.getNodeRefById(11)
      await backendEvent.centerOnNode()
      await (await backendEvent.getWidget(0)).click()
      await expect
        .poll(() => backendEvent.getWidget(1).then((w) => w.getValue()))
        .toBe('Event for node 11')

      const graphBuilder = await comfyPage.nodeOps.getNodeRefById(9)
      await graphBuilder.centerOnNode()
      await (await graphBuilder.getWidget(0)).click()
      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(16)

      await comfyPage.command.executeCommand('Comfy.Undo')
      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(14)
    })
  }
)
