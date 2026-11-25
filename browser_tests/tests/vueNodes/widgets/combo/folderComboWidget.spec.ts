import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { folderComboTest as test } from '@e2e/fixtures/folderComboFixture'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

test.describe('Vue combo folders', { tag: ['@vue-nodes', '@widget'] }, () => {
  test('folder locking scopes search and steppers and is keyboard reversible', async ({
    comfyPage,
    modelCombo
  }) => {
    await fitToViewInstant(comfyPage)
    const widget = await (
      await comfyPage.nodeOps.getNodeRefById(4)
    ).getWidgetByName('ckpt_name')

    await test.step('lock the browsed folder without committing a model', async () => {
      await modelCombo.open()
      await modelCombo.menu
        .getByRole('option', { name: 'Folder: studio' })
        .click()
      await modelCombo.menu
        .getByRole('option', { name: 'Folder: models' })
        .click()
      await modelCombo.searchInput.press('Shift+Tab')
      await expect(modelCombo.folderLock).toBeFocused()
      await modelCombo.folderLock.press('Enter')
      await expect(modelCombo.folderLock).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(modelCombo.searchInput).toBeFocused()
      await expect(modelCombo.options).toHaveText([
        'portrait.safetensors',
        'landscape.safetensors'
      ])
      await expect
        .poll(() => widget.getValue())
        .toBe('v1-5-pruned-emaonly-fp16.safetensors')
      await modelCombo.searchInput.fill('portrait')
      await expect(modelCombo.options).toHaveText([
        'studio/models/portrait.safetensors'
      ])
      await modelCombo.searchInput.press('Home')
      await expect(modelCombo.options).toHaveAttribute('data-highlighted')
      await modelCombo.searchInput.press('Enter')
      await expect(modelCombo.trigger).toBeFocused()
    })

    await test.step('save and reload the per-input lock with the workflow', async () => {
      const saved = await comfyPage.workflow.getExportedWorkflow()
      expect(
        saved.nodes.find((node) => node.id === 4)?.properties
          .widget_folder_locks
      ).toEqual({
        ckpt_name: ['studio', 'models']
      })
      await comfyPage.workflow.loadGraphData(saved)
      await fitToViewInstant(comfyPage)
      await modelCombo.open()
      await expect(modelCombo.folderLock).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(modelCombo.options).toHaveText([
        'portrait.safetensors',
        'landscape.safetensors'
      ])
      await modelCombo.searchInput.press('Escape')
    })

    await test.step('only within the boundary after closing', async () => {
      await expect(modelCombo.previous).toBeDisabled()
      await modelCombo.next.click()
      await expect
        .poll(() => widget.getValue())
        .toBe('studio/models/landscape.safetensors')
      await expect(modelCombo.next).toBeDisabled()
      await modelCombo.previous.click()
      await expect
        .poll(() => widget.getValue())
        .toBe('studio/models/portrait.safetensors')
    })

    await test.step('unlock from empty results using the keyboard', async () => {
      await modelCombo.open()
      await modelCombo.searchInput.fill('archive')
      await expect(modelCombo.options).toHaveCount(0)
      await expect(modelCombo.searchInput).not.toHaveAttribute(
        'aria-activedescendant'
      )
      await modelCombo.searchInput.press('Shift+Tab')
      await expect(modelCombo.folderLock).toBeFocused()
      await modelCombo.folderLock.press('Space')
      await expect(modelCombo.folderLock).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      await expect(modelCombo.searchInput).toBeFocused()
      await expect(modelCombo.options).toHaveText([
        'archive/portrait.safetensors'
      ])
      await modelCombo.searchInput.press('Escape')
      await expect(modelCombo.trigger).toBeFocused()
    })
  })

  test('deep search escapes the current folder and commits the original path', async ({
    comfyPage,
    modelCombo
  }) => {
    const widget = await (
      await comfyPage.nodeOps.getNodeRefById(4)
    ).getWidgetByName('ckpt_name')

    await test.step('browse without changing the model', async () => {
      await modelCombo.open()
      await modelCombo.menu
        .getByRole('option', { name: 'Folder: studio' })
        .click()
      await modelCombo.menu
        .getByRole('option', { name: 'Folder: models' })
        .click()
      await expect(modelCombo.searchInput).toBeFocused()
      await expect
        .poll(() => widget.getValue())
        .toBe('v1-5-pruned-emaonly-fp16.safetensors')
    })

    await test.step('search includes sibling folders and clearing returns to the directory', async () => {
      await modelCombo.searchInput.fill('PORTRAIT')
      await expect(modelCombo.options).toHaveText([
        'studio/models/portrait.safetensors',
        'archive/portrait.safetensors'
      ])
      await modelCombo.searchInput.clear()
      await expect(
        modelCombo.menu.getByRole('option', { name: 'Back: studio / models' })
      ).toBeVisible()
      await expect(
        modelCombo.menu.getByRole('option', {
          name: 'portrait.safetensors',
          exact: true
        })
      ).toBeVisible()
    })

    await test.step('select a search result with the pointer', async () => {
      await modelCombo.searchInput.fill('portrait')
      await modelCombo.menu
        .getByRole('option', {
          name: 'archive/portrait.safetensors',
          exact: true
        })
        .click()
      await expect(modelCombo.menu).toBeHidden()
      await expect(modelCombo.trigger).toBeFocused()
      await expect(modelCombo.trigger).toHaveText('portrait.safetensors')
      await expect
        .poll(() => widget.getValue())
        .toBe('archive/portrait.safetensors')
    })
  })

  test('keyboard folder navigation and an empty search never commit a model', async ({
    comfyPage,
    modelCombo
  }) => {
    const widget = await (
      await comfyPage.nodeOps.getNodeRefById(4)
    ).getWidgetByName('ckpt_name')

    await test.step('enter and leave a nested directory with the keyboard', async () => {
      await modelCombo.trigger.focus()
      await modelCombo.trigger.press('Enter')
      await expect(modelCombo.searchInput).toBeFocused()
      await modelCombo.searchInput.press('Home')
      await expect(
        modelCombo.menu.getByRole('option', { name: 'Folder: studio' })
      ).toHaveAttribute('data-highlighted')
      await modelCombo.searchInput.press('Enter')
      await modelCombo.searchInput.press('End')
      await expect(
        modelCombo.menu.getByRole('option', { name: 'Folder: models' })
      ).toHaveAttribute('data-highlighted')
      await modelCombo.searchInput.press('Enter')
      await modelCombo.searchInput.press('Home')
      await expect(
        modelCombo.menu.getByRole('option', { name: 'Back: studio / models' })
      ).toHaveAttribute('data-highlighted')
      await modelCombo.searchInput.press('Enter')
      await expect(
        modelCombo.menu.getByRole('option', {
          name: 'Back: studio',
          exact: true
        })
      ).toBeVisible()
    })

    await test.step('empty results clear the active option and Escape cancels', async () => {
      await modelCombo.searchInput.fill('does-not-exist')
      await expect(modelCombo.options).toHaveCount(0)
      await expect(
        comfyPage.page
          .getByRole('status')
          .filter({ hasText: 'No Results Found' })
      ).toBeVisible()
      await expect(modelCombo.searchInput).not.toHaveAttribute(
        'aria-activedescendant'
      )
      await modelCombo.searchInput.press('Enter')
      await expect(modelCombo.menu).toBeVisible()
      await expect(modelCombo.searchInput).toBeFocused()
      await modelCombo.searchInput.press('Escape')
      await expect(modelCombo.menu).toBeHidden()
      await expect(modelCombo.trigger).toBeFocused()
      await expect
        .poll(() => widget.getValue())
        .toBe('v1-5-pruned-emaonly-fp16.safetensors')
    })
  })
})
