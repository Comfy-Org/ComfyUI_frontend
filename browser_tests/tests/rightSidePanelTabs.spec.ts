import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

test.describe('Right Side Panel Tabs', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('Properties panel opens with workflow overview', async ({
    comfyPage
  }) => {
    await comfyPage.actionbar.propertiesButton.click()
    const { propertiesPanel } = comfyPage.menu

    await expect(propertiesPanel.root).toBeVisible()
    await expect(propertiesPanel.panelTitle).toContainText('Workflow Overview')
  })

  test('Properties panel shows node details on selection', async ({
    comfyPage
  }) => {
    await comfyPage.actionbar.propertiesButton.click()
    const { propertiesPanel } = comfyPage.menu

    await comfyPage.nodeOps.selectNodes(['KSampler'])

    await expect(propertiesPanel.panelTitle).toContainText('KSampler')
  })

  test('Node title input is editable', async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    const { propertiesPanel } = comfyPage.menu

    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await expect(propertiesPanel.panelTitle).toContainText('KSampler')

    // Click on the title to enter edit mode
    await propertiesPanel.panelTitle.click()
    const titleInput = propertiesPanel.root.getByTestId(TestIds.node.titleInput)
    await expect(titleInput).toBeVisible()

    await titleInput.fill('My Custom Sampler')
    await titleInput.press('Enter')

    await expect(propertiesPanel.panelTitle).toContainText('My Custom Sampler')
  })

  test('Search box filters properties', async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    const { propertiesPanel } = comfyPage.menu

    await comfyPage.nodeOps.selectNodes([
      'KSampler',
      'CLIP Text Encode (Prompt)'
    ])

    await expect(propertiesPanel.panelTitle).toContainText('3 items selected')
    await expect(propertiesPanel.root.getByText('KSampler')).toHaveCount(1)
    await expect(
      propertiesPanel.root.getByText('CLIP Text Encode (Prompt)')
    ).toHaveCount(2)

    await propertiesPanel.searchBox.fill('seed')
    await expect(propertiesPanel.root.getByText('KSampler')).toHaveCount(1)
    await expect(
      propertiesPanel.root.getByText('CLIP Text Encode (Prompt)')
    ).toHaveCount(0)

    await propertiesPanel.searchBox.fill('')
    await expect(propertiesPanel.root.getByText('KSampler')).toHaveCount(1)
    await expect(
      propertiesPanel.root.getByText('CLIP Text Encode (Prompt)')
    ).toHaveCount(2)
  })

  test('Expand all / Collapse all toggles sections', async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    const { propertiesPanel } = comfyPage.menu

    // Select multiple nodes so collapse toggle button appears
    await comfyPage.nodeOps.selectNodes([
      'KSampler',
      'CLIP Text Encode (Prompt)'
    ])

    // Sections default to collapsed when multiple nodes are selected,
    // so the button initially shows "Expand all"
    const expandButton = propertiesPanel.root.getByRole('button', {
      name: 'Expand all'
    })
    await expect(expandButton).toBeVisible()
    await expandButton.click()

    const collapseButton = propertiesPanel.root.getByRole('button', {
      name: 'Collapse all'
    })
    await expect(collapseButton).toBeVisible()
    await collapseButton.click()

    // After collapsing, the button label switches back to "Expand all"
    await expect(expandButton).toBeVisible()
  })

  test('Properties panel can be closed', async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    const { propertiesPanel } = comfyPage.menu

    await expect(propertiesPanel.root).toBeVisible()

    // The actionbar toggle button hides when the panel is open,
    // so use the close button inside the panel itself
    const closeButton = comfyPage.page.getByLabel('Toggle properties panel')
    await closeButton.click()
    await expect(propertiesPanel.root).toBeHidden()
  })
})
