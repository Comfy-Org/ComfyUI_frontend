import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Keyboard shortcut actions', { tag: '@keyboard' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup()
  })

  test('Ctrl+Z undoes and Ctrl+Shift+Z redoes the last graph change', async ({
    comfyPage
  }) => {
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    await test.step('Ctrl+Z undoes the last graph change', async () => {
      await comfyPage.page.evaluate(() => {
        const node = window.LiteGraph!.createNode('Note')
        window.app!.graph.add(node)
      })
      await comfyPage.nextFrame()
      await expect
        .poll(() => comfyPage.nodeOps.getNodeCount())
        .toBe(initialNodeCount + 1)

      await comfyPage.canvas.click()
      await comfyPage.page.keyboard.press('ControlOrMeta+z')

      await expect
        .poll(() => comfyPage.nodeOps.getNodeCount())
        .toBe(initialNodeCount)
    })

    await test.step('Ctrl+Shift+Z redoes after undo', async () => {
      await comfyPage.page.keyboard.press('ControlOrMeta+Shift+z')
      await expect
        .poll(() => comfyPage.nodeOps.getNodeCount())
        .toBe(initialNodeCount + 1)
    })
  })

  test('A second Ctrl+Shift+Z past the end of the history changes nothing', async ({
    comfyPage
  }) => {
    // Every node's position, not just the dragged one: a redo that re-applies
    // its delta to the wrong node would leave the dragged node correct and be
    // invisible to a single-node comparison.
    const positions = () =>
      comfyPage.page.evaluate(() =>
        Object.fromEntries(
          window.app!.graph.nodes.map((node) => [
            String(node.id),
            [...node.pos]
          ])
        )
      )

    const before = await positions()
    expect(
      Object.keys(before).length,
      'Default graph should have nodes'
    ).toBeGreaterThan(0)

    const node = await comfyPage.nodeOps.getNodeRefByTitle('KSampler')
    await node.dragBy({ x: 96, y: 64 })
    await expect.poll(positions).not.toEqual(before)
    const moved = await positions()

    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+z')
    await expect.poll(positions).toEqual(before)

    // The first redo restores the move. It is also the control for the two
    // assertions below: it proves the keystroke reaches the app and that a redo
    // with something on the stack visibly changes the graph.
    await comfyPage.page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(positions).toEqual(moved)

    await comfyPage.page.keyboard.press('ControlOrMeta+Shift+z')
    await comfyPage.nextFrame()
    expect(await positions(), 'Redo past the end must be a no-op').toEqual(
      moved
    )

    // And it must not have pushed an entry of its own. If it had, one undo
    // would land on an intermediate state instead of the pre-drag one — which
    // "positions are unchanged" above cannot distinguish on its own.
    await comfyPage.page.keyboard.press('ControlOrMeta+z')
    await expect.poll(positions).toEqual(before)
  })

  test('Ctrl+S opens save dialog', async ({ comfyPage }) => {
    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+s')

    const saveDialog = comfyPage.menu.topbar.getSaveDialog()
    await expect(saveDialog).toBeVisible()
  })

  test('Ctrl+, opens and Escape closes settings dialog', async ({
    comfyPage
  }) => {
    const settingsDialog = comfyPage.page.getByTestId('settings-dialog')

    await test.step('Ctrl+, opens settings dialog', async () => {
      await comfyPage.page.keyboard.down('ControlOrMeta')
      await comfyPage.page.keyboard.press(',')
      await comfyPage.page.keyboard.up('ControlOrMeta')

      await expect(settingsDialog).toBeVisible()
    })

    await test.step('Escape closes settings dialog', async () => {
      await comfyPage.page.keyboard.press('Escape')
      await expect(settingsDialog).toBeHidden()
    })
  })

  test('Delete key removes selected nodes', async ({ comfyPage }) => {
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()
    expect(initialNodeCount, 'Default graph should have nodes').toBeGreaterThan(
      0
    )

    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.page.keyboard.press('Delete')

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBeLessThan(initialNodeCount)
  })

  test('Ctrl+A selects all nodes', async ({ comfyPage }) => {
    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+a')

    const totalNodes = await comfyPage.nodeOps.getNodeCount()
    const selectedNodes = await comfyPage.page.evaluate(
      () => Object.keys(window.app!.canvas.selected_nodes).length
    )

    expect(selectedNodes).toBe(totalNodes)
  })
})
