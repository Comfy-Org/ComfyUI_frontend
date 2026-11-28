import type { Locator } from '@playwright/test'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

async function openPropertiesPanel(comfyPage: ComfyPage) {
  const { propertiesPanel } = comfyPage.menu
  await propertiesPanel.open(comfyPage.actionbar.propertiesButton)
  return propertiesPanel.root
}

async function selectSubgraphAndOpenEditor(
  comfyPage: ComfyPage,
  nodeTitle: string
) {
  const subgraphNodes = await comfyPage.nodeOps.getNodeRefsByTitle(nodeTitle)
  expect(subgraphNodes.length).toBeGreaterThan(0)
  await subgraphNodes[0].click('title')

  await openPropertiesPanel(comfyPage)

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
      test('hide toggle hides a linked promoted widget, and it can be re-shown', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )
        const shownSection = await selectSubgraphAndOpenEditor(
          comfyPage,
          'Sub 0'
        )
        const hiddenSection = comfyPage.page.getByTestId(
          TestIds.subgraphEditor.hiddenSection
        )

        const stringAItem = shownSection
          .getByTestId(TestIds.subgraphEditor.widgetItem)
          .filter({
            has: comfyPage.page
              .getByTestId(TestIds.subgraphEditor.widgetLabel)
              .filter({ hasText: 'string_a' })
          })
        await expect(stringAItem).toBeVisible()

        await test.step('Hide the linked input', async () => {
          await stringAItem
            .getByTestId(TestIds.subgraphEditor.widgetToggle)
            .click()

          await expect(stringAItem).toBeHidden()
        })

        const hiddenRow = hiddenSection
          .getByTestId(TestIds.subgraphEditor.widgetItem)
          .filter({
            has: comfyPage.page
              .getByTestId(TestIds.subgraphEditor.widgetLabel)
              .filter({ hasText: 'string_a' })
          })
        await expect(
          hiddenRow,
          'hidden input is listed in the hidden section'
        ).toBeVisible()

        await test.step('Show the hidden input again', async () => {
          await hiddenRow
            .getByTestId(TestIds.subgraphEditor.widgetToggle)
            .click()

          await expect(
            shownSection.getByTestId(TestIds.subgraphEditor.widgetItem).filter({
              has: comfyPage.page
                .getByTestId(TestIds.subgraphEditor.widgetLabel)
                .filter({ hasText: 'string_a' })
            }),
            'showing restores the input to the shown list'
          ).toBeVisible()
        })
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

      test(
        'control after generate does not display',
        { tag: '@vue-nodes' },
        async ({ comfyPage }) => {
          await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
          const subgraphNode = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
          const { editor } = comfyPage.subgraph
          await editor.ensureOpen(subgraphNode)

          await expect(
            editor.promotionItems.first(),
            'some promotion item is visible'
          ).toBeVisible()

          const widgetName = 'control_after_generate'
          await expect(editor.resolveItem({ widgetName })).toBeHidden()
        }
      )
    })

    test.describe('Parameters tab', () => {
      test('Hide a linked row', async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-nested-promotion'
        )
        const subgraphNodes =
          await comfyPage.nodeOps.getNodeRefsByTitle('Sub 0')
        expect(subgraphNodes.length).toBeGreaterThan(0)
        await subgraphNodes[0].click('title')

        const panel = await openPropertiesPanel(comfyPage)
        const hideInputButton = panel
          .getByTestId(TestIds.subgraphEditor.widgetActionsHideInputButton)
          .first()
        await expect(hideInputButton).toBeVisible()
        await expect(hideInputButton).toHaveAccessibleName('Hide input')

        const rowHeader = panel
          .getByTestId(TestIds.propertiesPanel.widgetRowHeader)
          .filter({
            has: comfyPage.page.getByTestId(
              TestIds.subgraphEditor.widgetActionsHideInputButton
            )
          })
          .first()
        const hideBox = await rowHeader
          .getByTestId(TestIds.subgraphEditor.widgetActionsHideInputButton)
          .boundingBox()
        const menuBox = await rowHeader
          .getByTestId(TestIds.subgraphEditor.widgetActionsMenuButton)
          .boundingBox()
        if (!hideBox || !menuBox) throw new Error('row actions missing')
        expect(hideBox.x, 'Hide input sits before the menu').toBeLessThan(
          menuBox.x
        )

        const moreButtons = panel.getByTestId(
          TestIds.subgraphEditor.widgetActionsMenuButton
        )
        await expect(moreButtons.first()).toBeVisible()
        const widgetCountBeforeHide = await moreButtons.count()

        await test.step('Hide the linked input', async () => {
          await hideInputButton.click()

          await expect
            .poll(() => moreButtons.count())
            .toBeLessThan(widgetCountBeforeHide)
        })
      })
    })
  }
)
