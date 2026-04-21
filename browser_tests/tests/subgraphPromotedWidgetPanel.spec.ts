import type { Locator } from '@playwright/test'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

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
  const subgraphNodes = await comfyPage.nodeOps.getNodeRefsByTitle(nodeTitle)
  expect(subgraphNodes.length).toBeGreaterThan(0)
  await subgraphNodes[0].click('title')

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
  const texts = await labels.allTextContents()
  return texts.map((t) => t.trim())
}

test.describe(
  'Subgraph promoted widget panel',
  { tag: ['@node', '@widget'] },
  () => {
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
        await expect(toggleButtons.first()).toBeVisible()

        const count = await toggleButtons.count()
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

        const linkIcons = shownSection.getByTestId(
          TestIds.subgraphEditor.iconLink
        )
        await expect(linkIcons.first()).toBeVisible()

        const eyeIcons = shownSection.getByTestId(
          TestIds.subgraphEditor.iconEye
        )
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

        await expect
          .poll(() => collectWidgetLabels(shownSection))
          .toEqual(
            expect.arrayContaining([
              expect.anything(),
              'renamed_from_sidepanel'
            ])
          )
        await expect
          .poll(() => collectWidgetLabels(shownSection))
          .not.toContain('text')
      })
    })

    test.describe('Parameters tab (WidgetActions menu)', () => {
      test('linked promoted widget menu should not show Hide/Show input', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )
        const subgraphNodes =
          await comfyPage.nodeOps.getNodeRefsByTitle('Sub 0')
        expect(subgraphNodes.length).toBeGreaterThan(0)
        await subgraphNodes[0].click('title')

        const panel = await ensurePropertiesPanel(comfyPage)

        const moreButtons = panel.getByTestId(
          TestIds.subgraphEditor.widgetActionsMenuButton
        )
        await expect(moreButtons.first()).toBeVisible()
        await moreButtons.first().click()

        const menu = comfyPage.page.getByTestId(TestIds.menu.moreMenuContent)
        await expect(menu).toBeVisible()
        await expect(menu.getByText('Hide input')).toHaveCount(0)
        await expect(menu.getByText('Show input')).toHaveCount(0)
        await expect(menu.getByText('Rename')).toBeVisible()
      })
    })
  }
)
