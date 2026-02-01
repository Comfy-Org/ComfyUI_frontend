import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Properties panel title editing', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(comfyPage.propertiesPanel.root).toBeVisible()
  })

  test.describe('Single node title editing', () => {
    test('shows editable title for single node selection', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])
      await propertiesPanel.panelTitle.click()

      await expect(propertiesPanel.nodeTitleInput).toBeVisible()
    })

    test('edits node title successfully', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])

      const newTitle = 'My Custom KSampler'

      await propertiesPanel.panelTitle.click()
      await propertiesPanel.nodeTitleInput.fill(newTitle)
      await propertiesPanel.nodeTitleInput.press('Enter')

      await expect(propertiesPanel.panelTitle).toContainText(newTitle)

      const renamedNodes = await comfyPage.getNodeRefsByTitle(newTitle)
      expect(renamedNodes.length).toBeGreaterThan(0)
    })

    test('cancels title edit with Escape', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])

      const originalTitle = await propertiesPanel.panelTitle.innerText()

      await propertiesPanel.panelTitle.click()
      await propertiesPanel.nodeTitleInput.fill('Should Not Be Saved')
      await propertiesPanel.nodeTitleInput.press('Escape')

      await expect(propertiesPanel.panelTitle).toContainText(originalTitle)
    })

    test('does not save empty title', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])

      const originalTitle = await propertiesPanel.panelTitle.innerText()

      await propertiesPanel.panelTitle.click()
      await propertiesPanel.nodeTitleInput.fill('')
      await propertiesPanel.nodeTitleInput.press('Enter')

      await expect(propertiesPanel.panelTitle).toContainText(originalTitle)
    })
  })

  test.describe('Title editing restrictions', () => {
    test('does not allow title editing for multiple selection', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler', 'VAE Decode'])
      await propertiesPanel.panelTitle.click()

      await expect(propertiesPanel.nodeTitleInput).not.toBeVisible()
    })

    test('does not allow title editing for workflow overview', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await propertiesPanel.panelTitle.click()

      await expect(propertiesPanel.nodeTitleInput).not.toBeVisible()
    })
  })
})
