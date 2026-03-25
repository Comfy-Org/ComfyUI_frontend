import type { Locator } from '@playwright/test'
import type { ComfyPage } from '../fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

async function ensurePropertiesPanel(comfyPage: ComfyPage) {
  const panel = comfyPage.menu.propertiesPanel.root
  if (!(await panel.isVisible())) {
    await comfyPage.actionbar.propertiesButton.click()
  }
  await expect(panel).toBeVisible()
  return panel
}

async function selectSubgraphAndOpenEditor(
  comfyPage: ComfyPage,
  nodeTitle: string
) {
  const subgraphNode = (
    await comfyPage.nodeOps.getNodeRefsByTitle(nodeTitle)
  )[0]
  await subgraphNode.click('title')

  await ensurePropertiesPanel(comfyPage)

  const editorToggle = comfyPage.page.getByTestId(TestIds.subgraphEditor.toggle)
  await expect(editorToggle).toBeVisible()
  await editorToggle.click()

  const shownSection = comfyPage.page.getByTestId(
    TestIds.subgraphEditor.shownSection
  )
  await expect(shownSection).toBeVisible()
  return shownSection
}

async function collectWidgetLabels(shownSection: Locator) {
  const labels = shownSection.getByTestId(TestIds.subgraphEditor.widgetLabel)
  const count = await labels.count()
  const texts: string[] = []
  for (let i = 0; i < count; i++) {
    const text = await labels.nth(i).textContent()
    if (text) texts.push(text.trim())
  }
  return texts
}

test.describe(
  'Subgraph promoted widget panel',
  { tag: ['@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test.describe('SubgraphEditor (Settings panel)', () => {
      test('linked promoted widgets have hide toggle disabled', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )
        const shownSection = await selectSubgraphAndOpenEditor(
          comfyPage,
          'Sub 0'
        )

        const toggleButtons = shownSection.getByTestId(
          TestIds.subgraphEditor.widgetToggle
        )
        const count = await toggleButtons.count()
        expect(count).toBeGreaterThan(0)

        for (let i = 0; i < count; i++) {
          await expect(toggleButtons.nth(i)).toBeDisabled()
        }
      })

      test('linked promoted widgets show link icon instead of eye icon', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )
        const shownSection = await selectSubgraphAndOpenEditor(
          comfyPage,
          'Sub 0'
        )

        const linkIcons = shownSection.locator('.icon-\\[lucide--link\\]')
        await expect(linkIcons.first()).toBeVisible()

        const eyeIcons = shownSection.locator('.icon-\\[lucide--eye\\]')
        await expect(eyeIcons).toHaveCount(0)
      })

      test('widget labels display renamed values instead of raw names', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/test-values-input-subgraph'
        )
        const shownSection = await selectSubgraphAndOpenEditor(
          comfyPage,
          'Input Test Subgraph'
        )

        const allTexts = await collectWidgetLabels(shownSection)
        expect(allTexts.length).toBeGreaterThan(0)

        // The fixture has a widget with name="text" but
        // label="renamed_from_sidepanel". The panel should show the
        // renamed label, not the raw widget name.
        expect(allTexts).toContain('renamed_from_sidepanel')
        expect(allTexts).not.toContain('text')
      })
    })

    test.describe('Parameters tab (WidgetActions menu)', () => {
      test('linked promoted widget menu should not show Hide/Show input', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )
        const subgraphNode = (
          await comfyPage.nodeOps.getNodeRefsByTitle('Sub 0')
        )[0]
        await subgraphNode.click('title')

        const panel = await ensurePropertiesPanel(comfyPage)

        const moreButtons = panel.locator('.icon-\\[lucide--more-vertical\\]')
        await expect(moreButtons.first()).toBeVisible()
        await moreButtons.first().click()

        await expect(comfyPage.page.getByText('Hide input')).toHaveCount(0)
        await expect(comfyPage.page.getByText('Show input')).toHaveCount(0)
        await expect(comfyPage.page.getByText('Rename')).toBeVisible()
      })
    })
  }
)
