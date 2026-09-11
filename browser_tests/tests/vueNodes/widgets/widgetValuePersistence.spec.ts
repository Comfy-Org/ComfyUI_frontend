import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

test.describe(
  'Widget value persistence',
  { tag: ['@widget', '@vue-nodes'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('an emptied text widget remains empty after save and reopen', async ({
      comfyPage
    }) => {
      test.slow()
      await comfyPage.workflow.loadWorkflow('inputs/string_input')

      const widget = comfyPage.vueNodes.getWidgetByName(
        'Node With String Input',
        'string_input'
      )
      await widget.fill('temporary value')
      await expect(widget).toHaveValue('temporary value')
      await widget.fill('')
      await expect(widget).toHaveValue('')

      await comfyPage.menu.topbar.saveWorkflow('empty-widget-value')
      await comfyPage.menu.topbar.closeWorkflowTab('empty-widget-value')
      await comfyPage.page.keyboard.press('w')
      await comfyPage.menu.workflowsTab
        .getPersistedItem('empty-widget-value')
        .dblclick()
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toContain('empty-widget-value')
      await comfyPage.vueNodes.waitForNodes()

      await expect(
        comfyPage.vueNodes.getWidgetByName(
          'Node With String Input',
          'string_input'
        )
      ).toHaveValue('')
    })

    test.describe('LoadImageOutput', { tag: ['@oss', '@slow'] }, () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.page.route(
          '**/internal/files/output**',
          async (route) => {
            if (route.request().method() !== 'GET') {
              await route.fallback()
              return
            }
            await route.fulfill({
              json: [
                'first-output.webp [output]',
                'selected-output.webp [output]'
              ]
            })
          }
        )
        const image = {
          contentType: 'image/webp',
          path: assetPath('image64x64.webp')
        }
        await mockViewFiles(comfyPage.page, {
          'first-output.webp [output]': image,
          'selected-output.webp': image,
          'selected-output.webp [output]': image
        })
        await comfyPage.assets.mockOutputHistory([
          createMockJob({
            id: 'job-selected-output',
            create_time: 1000,
            execution_start_time: 1000,
            execution_end_time: 1010,
            preview_output: {
              filename: 'selected-output.webp',
              subfolder: '',
              type: 'output',
              nodeId: '1',
              mediaType: 'images'
            }
          })
        ])
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
        await comfyPage.searchBoxV2.addNode('Load Image (from Outputs)')
        await comfyPage.vueNodes.waitForNodes()
      })

      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.canvasOps.resetView()
      })

      test('keeps a selected non-first output and its preview after save and reload', async ({
        comfyPage
      }) => {
        const selectedValue = 'selected-output.webp [output]'
        const node = comfyPage.vueNodes.getNodeByTitle(
          'Load Image (from Outputs)'
        )
        await WidgetSelectDropdownFixture.fromTrigger(
          node.getByRole('button', {
            name: 'first-output.webp [output]',
            exact: true
          })
        ).open()
        const menu = comfyPage.page.getByTestId(
          TestIds.widgets.formDropdownMenu
        )
        await menu
          .getByRole('button', { name: 'Imported', exact: true })
          .click()
        const selectedOption = menu.getByText(selectedValue, { exact: true })
        await selectedOption.click()
        await expect(menu).toBeHidden()
        await expect(
          node.getByRole('button', { name: selectedValue, exact: true })
        ).toBeVisible()
        const nodes =
          await comfyPage.nodeOps.getNodeRefsByType('LoadImageOutput')
        expect(nodes, 'Workflow has one output image loader').toHaveLength(1)
        const imageWidget = await nodes[0].getWidgetByName('image')
        await expect.poll(() => imageWidget.getValue()).toBe(selectedValue)

        await comfyPage.menu.topbar.saveWorkflow('remote-output-selection')
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.vueNodes.waitForNodes()

        await WidgetSelectDropdownFixture.fromTrigger(
          node.getByRole('button', {
            name: /^(first|selected)-output\.webp \[output\]$/
          })
        ).open()
        await menu
          .getByRole('button', { name: 'Imported', exact: true })
          .click()
        await expect(
          menu.getByText('first-output.webp [output]', { exact: true })
        ).toBeVisible()
        await expect(selectedOption).toBeVisible()
        await comfyPage.page.keyboard.press('Escape')
        await expect(menu).toBeHidden()

        await expect.poll(() => imageWidget.getValue()).toBe(selectedValue)
        await expect(
          node.getByRole('button', { name: selectedValue, exact: true })
        ).toBeVisible()
        const preview = node.getByTestId(TestIds.node.mainImage)
        await expect(preview).toBeVisible()
        await expect
          .poll(async () => {
            const src = await preview.getAttribute('src')
            return src
              ? new URL(src, comfyPage.page.url()).searchParams.get('filename')
              : null
          })
          .toBe(selectedValue)
        await expect(preview).toHaveJSProperty('naturalWidth', 64)
      })
    })
  }
)
