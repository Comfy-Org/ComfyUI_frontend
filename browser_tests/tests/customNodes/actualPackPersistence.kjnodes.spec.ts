import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { hasInstalledPack } from '@e2e/fixtures/utils/customNodeSuite'

test.describe(
  'actual KJNodes dependent widgets @custom-nodes',
  { tag: ['@oss', '@node', '@widget'] },
  () => {
    if (!hasInstalledPack('ComfyUI-KJNodes')) return

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    for (const vueNodesEnabled of [false, true])
      test(`ImageTransformKJ swaps and restores dependent controls (${vueNodesEnabled ? 'Vue' : 'legacy'} renderer)`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.waitForWorkflowIdle()

        const nodeId = await comfyPage.page.evaluate(() => {
          const node = window.LiteGraph!.createNode('ImageTransformKJ')
          if (!node) throw new Error('ImageTransformKJ is not registered')
          window.app!.graph.add(node)
          return String(node.id)
        })
        const node = await comfyPage.nodeOps.getNodeRefById(nodeId)
        await node.centerOnNode()

        const selectCombo = async (name: string, value: string) => {
          if (vueNodesEnabled) {
            await comfyPage.vueNodes.selectComboOption(
              'Image Transform KJ',
              name.replace('keep_proportion.', ''),
              value
            )
            return
          }

          await (await node.getWidgetByName(name)).click()
          await comfyPage.page
            .locator('.litecontextmenu .litemenu-entry')
            .getByText(value, { exact: true })
            .click()
        }
        const fillNumber = async (name: string, value: number) => {
          if (vueNodesEnabled) {
            const widget = comfyPage.vueNodes.getWidgetByName(
              'Image Transform KJ',
              name
            )
            await comfyPage.vueNodes
              .getInputNumberControls(widget)
              .input.fill(String(value))
            return
          }

          await (await node.getWidgetByName(name)).click()
          await comfyPage.nodeOps.fillLegacyWidgetDialog(String(value))
        }
        const dependentState = () =>
          comfyPage.page.evaluate((id) => {
            const mounted = window.app!.graph.nodes.find(
              (candidate) => String(candidate.id) === id
            )
            if (!mounted) throw new Error(`Node ${id} is not mounted`)
            return mounted
              .widgets!.filter(({ name }) =>
                name.startsWith('keep_proportion.')
              )
              .map(({ name, value }) => ({ name, value }))
          }, nodeId)
        const dependentRoster = async () =>
          (await dependentState()).map(({ name }) => name)

        await selectCombo('keep_proportion', 'pad_edge')
        await expect
          .poll(dependentRoster)
          .toEqual([
            'keep_proportion.edge_mode',
            'keep_proportion.pad_x',
            'keep_proportion.pad_y'
          ])
        await selectCombo('keep_proportion.edge_mode', 'mirror')
        await fillNumber('keep_proportion.pad_x', 0.23)
        await fillNumber('keep_proportion.pad_y', 0.81)

        await selectCombo('keep_proportion', 'multiplier')
        await expect
          .poll(dependentRoster)
          .toEqual([
            'keep_proportion.width_mult',
            'keep_proportion.height_mult'
          ])
        await fillNumber('keep_proportion.width_mult', 1.7)
        await fillNumber('keep_proportion.height_mult', 0.65)

        await selectCombo('keep_proportion', 'pad_edge')
        await expect.poll(dependentState).toEqual([
          { name: 'keep_proportion.edge_mode', value: 'mirror' },
          { name: 'keep_proportion.pad_x', value: 0.23 },
          { name: 'keep_proportion.pad_y', value: 0.81 }
        ])

        await selectCombo('keep_proportion', 'multiplier')
        await expect.poll(dependentState).toEqual([
          { name: 'keep_proportion.width_mult', value: 1.7 },
          { name: 'keep_proportion.height_mult', value: 0.65 }
        ])
      })
  }
)
