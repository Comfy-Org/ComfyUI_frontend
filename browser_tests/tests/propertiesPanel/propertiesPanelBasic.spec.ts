import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Properties panel basic functionality', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(comfyPage.propertiesPanel.root).toBeVisible()
  })

  test.describe('Panel visibility and toggle', () => {
    test('opens panel via actionbar button', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await propertiesPanel.close()
      await expect(propertiesPanel.root).not.toBeVisible()

      await comfyPage.actionbar.propertiesButton.click()
      await expect(propertiesPanel.root).toBeVisible()
    })

    test('closes panel via close button', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await expect(propertiesPanel.root).toBeVisible()
      await propertiesPanel.closeButton.click()
      await expect(propertiesPanel.root).not.toBeVisible()
    })

    test('persists open state after page reload', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await expect(propertiesPanel.root).toBeVisible()

      await comfyPage.page.reload()
      await comfyPage.setup()

      await expect(propertiesPanel.root).toBeVisible()
    })
  })

  test.describe('Workflow overview (no selection)', () => {
    test('shows "Workflow Overview" title when nothing selected', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await expect(propertiesPanel.panelTitle).toContainText(
        'Workflow Overview'
      )
    })

    test('shows Parameters, Nodes, and Global Settings tabs when nothing selected', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()
      await expect(propertiesPanel.getTab('Nodes')).toBeVisible()
      await expect(propertiesPanel.getTab('Global Settings')).toBeVisible()
    })

    test('Nodes tab displays workflow nodes', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await propertiesPanel.clickTab('Nodes')
      await expect(propertiesPanel.root).toContainText('KSampler')
    })
  })

  test.describe('Single node selection', () => {
    test('updates title to node name when single node selected', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])

      await expect(propertiesPanel.panelTitle).not.toContainText(
        'Workflow Overview'
      )
    })

    test('shows Parameters, Info, and Settings tabs for single node', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])

      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()
      await expect(propertiesPanel.getTab('Info')).toBeVisible()
      await expect(propertiesPanel.getTab('Settings')).toBeVisible()
      await expect(propertiesPanel.getTab('Nodes')).not.toBeVisible()
    })

    test('Info tab shows node documentation', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])
      await propertiesPanel.clickTab('Info')

      await expect(propertiesPanel.root).toContainText('KSampler')
    })

    test('shows widget inputs in Parameters tab', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])

      await expect(propertiesPanel.root.getByText('seed')).toBeVisible()
      await expect(propertiesPanel.root.getByText('steps')).toBeVisible()
      await expect(propertiesPanel.root.getByText('cfg')).toBeVisible()
    })
  })

  test.describe('Multiple node selection', () => {
    test('shows item count in title for multiple selections', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler', 'VAE Decode'])

      await expect(propertiesPanel.panelTitle).toContainText('items selected')
    })

    test('shows Parameters and Settings tabs for multiple selection', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler', 'VAE Decode'])

      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()
      await expect(propertiesPanel.getTab('Settings')).toBeVisible()
      await expect(propertiesPanel.getTab('Info')).not.toBeVisible()
    })

    test('lists all selected nodes in Parameters tab', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler', 'VAE Decode'])

      await expect(propertiesPanel.root.getByText('KSampler')).toBeVisible()
      await expect(
        propertiesPanel.root.getByText('VAE Decode')
      ).toBeVisible()
    })
  })
})
