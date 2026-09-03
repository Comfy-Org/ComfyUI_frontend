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
      expect(workflow.nodes).toHaveLength(14)
      expect(workflow.nodes.map(({ type }) => type)).toEqual(
        expect.arrayContaining([
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
      )
      expect(
        workflow.nodes.find(({ id }) => String(id) === '7')?.howToState
      ).toBe('paused')

      const lifecycleBadge = await comfyPage.nodeOps.getNodeRefById(7)
      await lifecycleBadge.centerOnNode()
      expect(await lifecycleBadge.getContextMenuOptionNames()).toContain(
        'Resume'
      )
      await comfyPage.contextMenu.clickMenuItem('Resume')
      await comfyPage.contextMenu.waitForHidden()
      const resumedWorkflow = await comfyPage.workflow.getExportedWorkflow()
      expect(
        resumedWorkflow.nodes.find(({ id }) => String(id) === '7')?.howToState
      ).toBe('ready')

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

      // The backend node returns its text as ui output, which lands in the
      // host's per-node output record when the `executed` message arrives.
      // Until it does, the run has only been queued, not executed. Keyed by
      // node locator, which is the bare id or `<graphId>:<id>` for the root.
      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(() => {
              const outputs = window.app!.nodeOutputs
              const entry = Object.entries(outputs).find(
                ([key]) => key === '3' || key.endsWith(':3')
              )
              const text = entry?.[1].text
              return Array.isArray(text) ? text[0] : text
            }),
          { timeout: 10_000 }
        )
        .toBe(HOW_TO_TEXT)

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

    test('reports rejected asynchronous example actions', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodeApi/how-to-examples')

      const backendPing = await comfyPage.nodeOps.getNodeRefById(10)
      await backendPing.centerOnNode()
      await comfyPage.page.route('**/how-to-api/ping', (route) =>
        route.fulfill({ status: 503, body: 'Unavailable' })
      )
      await (await backendPing.getWidget(0)).click()
      await expect
        .poll(() =>
          backendPing.getWidget(1).then((widget) => widget.getValue())
        )
        .toContain('Backend ping failed: HTTP 503')

      await comfyPage.page.unroute('**/how-to-api/ping')
      await comfyPage.page.route('**/how-to-api/ping', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'not json'
        })
      )
      await (await backendPing.getWidget(0)).click()
      await expect
        .poll(() =>
          backendPing.getWidget(1).then((widget) => widget.getValue())
        )
        .toContain('Backend ping failed:')

      const backendEvent = await comfyPage.nodeOps.getNodeRefById(11)
      await backendEvent.centerOnNode()
      await comfyPage.page.route('**/how-to-api/event', (route) =>
        route.fulfill({ status: 500, body: 'Event rejected' })
      )
      await (await backendEvent.getWidget(0)).click()
      await expect
        .poll(() =>
          backendEvent.getWidget(1).then((widget) => widget.getValue())
        )
        .toContain('Backend event failed: HTTP 500')

      const settingsStorage = await comfyPage.nodeOps.getNodeRefById(12)
      await settingsStorage.centerOnNode()
      await comfyPage.page.route('**/api/userdata/**', (route) =>
        route.fulfill({ status: 500, body: 'Storage rejected' })
      )
      await (await settingsStorage.getWidget(1)).click()
      await expect
        .poll(() =>
          settingsStorage.getWidget(4).then((widget) => widget.getValue())
        )
        .toContain('Save greeting failed:')
    })

    test('reports a rejected command action', async ({ comfyPage }) => {
      await comfyPage.page.route(
        '**/extensions/how_to_execution/execution.js',
        async (route) => {
          const response = await route.fetch()
          const source = await response.text()
          const rejectedSource = source.replace(
            "api.commands.run('HowTo.ApiExamples.showGreeting')",
            "api.commands.run('HowTo.ApiExamples.missing')"
          )
          if (rejectedSource === source) {
            throw new Error('Expected to replace the example command')
          }
          await route.fulfill({ response, body: rejectedSource })
        }
      )
      await comfyPage.page.reload()
      await comfyPage.waitForAppReady()
      await comfyPage.workflow.loadWorkflow('nodeApi/how-to-examples')

      const settingsStorage = await comfyPage.nodeOps.getNodeRefById(12)
      await settingsStorage.centerOnNode()
      await (await settingsStorage.getWidget(3)).click()
      await expect
        .poll(() =>
          settingsStorage.getWidget(4).then((widget) => widget.getValue())
        )
        .toContain('Run greeting command failed: Command')
    })
  }
)
