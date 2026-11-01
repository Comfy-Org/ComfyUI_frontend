import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/zipTieFixture'

test.use({ trace: 'on' })

test.describe('Zip ties', { tag: ['@canvas', '@vue-nodes'] }, () => {
  test.use({
    initialSettings: {
      'Comfy.Canvas.NavigationMode': 'standard',
      'Comfy.Minimap.Visible': false
    }
  })

  test('creates, moves, saves, reloads and releases a tie without changing connections', async ({
    comfyPage,
    zipTie
  }) => {
    const initial = await zipTie.routing()
    expect(initial.ties).toBe(0)

    await test.step('Create the tie through a Meta+Shift marquee', async () => {
      await zipTie.beginMarquee()
      await expect(
        comfyPage.page.getByTestId('selection-rectangle')
      ).toBeVisible()
      expect(await zipTie.routing()).toEqual(initial)
      await zipTie.finishMarquee()
      await expect.poll(async () => (await zipTie.routing()).ties).toBe(1)
      expect((await zipTie.routing()).reroutes).toHaveLength(
        initial.reroutes.length + 6
      )
      expect((await zipTie.routing()).connections).toEqual(initial.connections)
    })

    const created = await zipTie.routing()

    await test.step('Undo and redo the gesture as a single edit', async () => {
      await comfyPage.keyboard.undo()
      await expect.poll(() => zipTie.routing()).toEqual(initial)
      await comfyPage.keyboard.redo()
      await expect.poll(() => zipTie.routing()).toEqual(created)
    })

    await test.step('Move the actual clasp with the mouse', async () => {
      const before = await zipTie.clasp()
      await zipTie.moveClasp()
      await expect
        .poll(() => zipTie.clasp())
        .toMatchObject({
          x: expect.closeTo(before.x + 80, 2),
          y: expect.closeTo(before.y + 50, 2)
        })
    })

    const moved = await zipTie.routing()

    await test.step('Save to the backend and restore after a page reload', async () => {
      await zipTie.save()
      const saved = await zipTie.savedWorkflow()
      expect(saved.extra?.reroutes).toEqual(moved.reroutes)
      expect(saved.links).toEqual(initial.connections)
      await comfyPage.workflow.reloadAndWaitForApp()
      await expect.poll(() => zipTie.routing()).toEqual(moved)
    })

    await test.step('Release from the clasp context menu', async () => {
      await zipTie.releaseClasp()
      await expect.poll(() => zipTie.routing()).toEqual(initial)
    })
  })

  test('Escape cancels the real drag before a tie is created', async ({
    comfyPage,
    zipTie
  }) => {
    const initial = await zipTie.routing()
    await zipTie.beginMarquee()
    await expect(
      comfyPage.page.getByTestId('selection-rectangle')
    ).toBeVisible()
    await zipTie.cancelMarquee()

    await expect(comfyPage.page.getByTestId('selection-rectangle')).toBeHidden()
    expect(await zipTie.routing()).toEqual(initial)
  })
})
