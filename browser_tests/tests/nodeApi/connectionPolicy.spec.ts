import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

for (const vueNodes of [false, true]) {
  test.describe(
    `Connection policy (${vueNodes ? 'Vue' : 'canvas'})`,
    { tag: ['@node', '@canvas', ...(vueNodes ? ['@vue-nodes'] : [])] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.page.evaluate(() => {
          const api = window.comfy!
          api.defs.define({
            type: 'Policy/AllowedSource',
            execution: 'frontend',
            outputs: [{ name: 'image', type: 'IMAGE' }]
          })
          api.defs.define({
            type: 'Policy/OtherSource',
            execution: 'frontend',
            outputs: [{ name: 'image', type: 'IMAGE' }]
          })
          api.defs.define({
            type: 'Policy/Gate',
            execution: 'frontend',
            inputs: [
              { name: 'image', type: 'IMAGE' },
              { name: 'extra', type: 'IMAGE' }
            ],
            connectionPolicy: {
              rules: [
                {
                  side: 'input',
                  slots: ['image'],
                  peerTypes: ['Policy/AllowedSource'],
                  allow: 'only'
                }
              ]
            }
          })
        })
        await comfyPage.workflow.loadWorkflow('nodeApi/connection-policy')
        await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
        await comfyPage.nextFrame()
      })

      test('preserves the existing link after refusal and allows an unguarded slot', async ({
        comfyPage
      }) => {
        const other = await comfyPage.nodeOps.getNodeRefById(2)
        const gate = await comfyPage.nodeOps.getNodeRefById(3)

        await other.connectOutput(0, gate, 0)
        await comfyPage.nextFrame()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() =>
              window
                .comfy!.graph.links()
                .map((link) => [
                  link.sourceNodeId,
                  link.sourceIndex,
                  link.targetNodeId,
                  link.targetIndex
                ])
            )
          )
          .toEqual([['1', 0, '3', 0]])

        await other.connectOutput(0, gate, 1)
        await comfyPage.nextFrame()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() =>
              window
                .comfy!.graph.links()
                .map((link) => [
                  link.sourceNodeId,
                  link.sourceIndex,
                  link.targetNodeId,
                  link.targetIndex
                ])
            )
          )
          .toEqual([
            ['1', 0, '3', 0],
            ['2', 0, '3', 1]
          ])

        await comfyPage.command.executeCommand('Comfy.Undo')

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() =>
              window
                .comfy!.graph.links()
                .map((link) => [
                  link.sourceNodeId,
                  link.sourceIndex,
                  link.targetNodeId,
                  link.targetIndex
                ])
            )
          )
          .toEqual([['1', 0, '3', 0]])
      })
    }
  )
}
