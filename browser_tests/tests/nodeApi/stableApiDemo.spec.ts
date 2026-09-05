import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const DEMO_TEXT = 'Hello from the published node API'

test.describe('Published node API demos', { tag: ['@node'] }, () => {
  test('resolve into and execute a backend prompt', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('nodeApi/stable-api-demo')

    const workflow = await comfyPage.workflow.getExportedWorkflow()
    expect(workflow.nodes.map(({ type }) => type)).toEqual([
      'DEMO/ConstantText',
      'DEMO/Reroute',
      'PreviewAny'
    ])

    const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
    expect(prompt).toEqual({
      '3': {
        inputs: { source: DEMO_TEXT },
        class_type: 'PreviewAny',
        _meta: { title: 'Preview as Text' }
      }
    })

    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const output = await comfyPage.nodeOps.getNodeRefById(3)
    await expect
      .poll(async () => (await output.getWidget(0)).getValue(), {
        timeout: 10_000
      })
      .toBe(DEMO_TEXT)
  })
})
