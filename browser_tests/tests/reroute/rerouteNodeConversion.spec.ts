import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const workflow = 'reroute/legacy_reroute_nodes'
const convertOne = 'Convert to Link Reroute'
const convertAll = 'Convert All Reroute Nodes to Link Reroutes'

test.describe(
  'Reroute node conversion',
  { tag: ['@vue-nodes', '@node', '@oss'] },
  () => {
    test.describe('Repair menu', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(workflow)
      })

      test('Converts one Reroute node from its menu and undoes it', async ({
        comfyPage
      }) => {
        const reroute = comfyPage.vueNodes.getNodeLocator('3')
        await reroute.click()
        await comfyPage.contextMenu.openFor(reroute)
        await expect(comfyPage.contextMenu.menuItem('Repair')).toBeVisible()
        await comfyPage.contextMenu.clickMenuItemExact(convertOne)

        await expect(reroute).toHaveCount(0)
        const converted = await comfyPage.workflow.getExportedWorkflow()
        expect(converted.links).toEqual(
          expect.arrayContaining([[4, 2, 0, 4, 1, 'VAE']])
        )
        expect(converted.extra?.reroutes).toHaveLength(1)

        await comfyPage.keyboard.undo()
        await expect(reroute).toBeVisible()
        const restored = await comfyPage.workflow.getExportedWorkflow()
        expect(restored.links).toEqual(
          expect.arrayContaining([[4, 3, 0, 4, 1, 'VAE']])
        )
      })

      test('Converts every supported Reroute node from the canvas menu in one undo step', async ({
        comfyPage
      }) => {
        await comfyPage.canvasOps.rightClick(1150, 250)
        await expect(comfyPage.contextMenu.menuItem('Repair')).toBeVisible()
        await comfyPage.contextMenu.clickLitegraphMenuItem(convertAll)

        await expect(
          comfyPage.toast.withText('Converted 2 Reroute nodes to link reroutes')
        ).toBeVisible()
        const converted = await comfyPage.workflow.getExportedWorkflow()
        expect(converted.nodes.map((node) => node.id)).toEqual(
          expect.arrayContaining([1, 4, 5, 6])
        )
        expect(converted.nodes).toHaveLength(4)
        expect(converted.links).toEqual(
          expect.arrayContaining([
            [3, 1, 2, 5, 1, 'VAE'],
            [4, 1, 2, 4, 1, 'VAE']
          ])
        )
        expect(converted.links).toHaveLength(2)
        expect(converted.extra?.reroutes).toHaveLength(2)

        await comfyPage.keyboard.undo()
        await expect(comfyPage.vueNodes.getNodeLocator('2')).toBeVisible()
        await expect(comfyPage.vueNodes.getNodeLocator('3')).toBeVisible()
      })

      test('Omits the Repair section when nothing is eligible', async ({
        comfyPage
      }) => {
        const { header } =
          await comfyPage.vueNodes.getFixtureByTitle('Upper decode')
        await comfyPage.contextMenu.openForVueNode(header)
        await expect(comfyPage.contextMenu.menuItem('Delete')).toBeVisible()
        await expect(comfyPage.contextMenu.menuItem('Repair')).toBeHidden()
        await comfyPage.page.keyboard.press('Escape')

        const dangling = comfyPage.vueNodes.getNodeLocator('6')
        await dangling.click()
        await comfyPage.contextMenu.openFor(dangling)
        await expect(comfyPage.contextMenu.menuItem('Delete')).toBeVisible()
        await expect(comfyPage.contextMenu.menuItem('Repair')).toBeHidden()
        await expect(comfyPage.contextMenu.menuItem(convertOne)).toBeHidden()
      })
    })

    test.describe('Preferring link reroutes', () => {
      test.use({
        initialSettings: { 'LiteGraph.Reroute.PreferLinkReroutes': true }
      })

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(workflow)
      })

      test('Converts supported Reroute nodes on load and leaves the rest', async ({
        comfyPage
      }) => {
        await expect(comfyPage.vueNodes.getNodeLocator('2')).toHaveCount(0)
        await expect(comfyPage.vueNodes.getNodeLocator('6')).toBeVisible()
        const loaded = await comfyPage.workflow.getExportedWorkflow()
        expect(loaded.extra?.reroutes).toHaveLength(2)

        await comfyPage.canvasOps.rightClick(1150, 250)
        await expect(comfyPage.contextMenu.menuItem('Add Group')).toBeVisible()
        await expect(comfyPage.contextMenu.menuItem('Repair')).toBeHidden()
      })

      test('Hides the Reroute node from node search', async ({ comfyPage }) => {
        await comfyPage.searchBoxV2.open()
        await comfyPage.searchBoxV2.input.fill('Reroute')
        await expect(
          comfyPage.searchBoxV2.results.getByText('Reroute', { exact: true })
        ).toHaveCount(0)
      })
    })
  }
)
