import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Capture keyboard shortcuts', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const app = window.app
      const command = app?.extensionManager.command.commands.find(
        ({ id }) => id === 'Comfy.Canvas.SelectAll'
      )
      if (!app || !command) throw new Error('Select all is unavailable')
      const execute = command.function
      const observations = (window.__commandExecutionCounts = {
        executions: 0,
        bubbleEvents: 0,
        preventedAtBubble: 0,
        selectedAtBubble: 0
      })
      command.function = (metadata) => {
        observations.executions++
        return execute(metadata)
      }
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'a' || !(event.ctrlKey || event.metaKey)) return
        observations.bubbleEvents++
        observations.preventedAtBubble = Number(event.defaultPrevented)
        observations.selectedAtBubble = Object.keys(
          app.canvas.selected_nodes
        ).length
        if (!event.defaultPrevented) void command.function()
      })
    })
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('selects once before extension bubble listeners observe the event', async ({
    comfyPage
  }) => {
    const nodeCount = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCount).toBeGreaterThan(0)
    await comfyPage.canvas.focus()
    await comfyPage.keyboard.press('ControlOrMeta+a')

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => window.__commandExecutionCounts)
      )
      .toEqual({
        executions: 1,
        bubbleEvents: 1,
        preventedAtBubble: 1,
        selectedAtBubble: nodeCount
      })
  })
})
