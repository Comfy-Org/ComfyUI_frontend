import { expect } from '@playwright/test'

import { layerEditorTest as test } from '@e2e/fixtures/helpers/LayerEditorHelper'

test.describe('Layer Editor history', { tag: '@ui' }, () => {
  test('reorders layers through undo and redo', async ({ layerEditor }) => {
    const originalOrder = await layerEditor.layerNames()

    await layerEditor.layerRows.first().click()
    await layerEditor.moveDownButton.click()
    await expect
      .poll(() => layerEditor.layerNames())
      .toEqual([...originalOrder].reverse())

    await layerEditor.undoButton.click()
    await expect.poll(() => layerEditor.layerNames()).toEqual(originalOrder)

    await layerEditor.redoButton.click()
    await expect
      .poll(() => layerEditor.layerNames())
      .toEqual([...originalOrder].reverse())
  })

  test('restores a cleared numeric field on blur', async ({ layerEditor }) => {
    await layerEditor.layerRows.first().click()
    const originalX = await layerEditor.xInput.inputValue()

    await layerEditor.xInput.fill('')
    await layerEditor.xInput.press('Tab')

    await expect(layerEditor.xInput).toHaveValue(originalX)
  })
})
