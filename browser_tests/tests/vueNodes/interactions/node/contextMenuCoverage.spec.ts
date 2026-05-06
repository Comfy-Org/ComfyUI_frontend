import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  clickExactMenuItem,
  getNodeRef,
  openContextMenu,
  openMultiNodeContextMenu
} from '@e2e/fixtures/utils/contextMenuTestHelpers'

test.describe(
  'Vue Node Context Menu — Extended Coverage',
  { tag: '@vue-nodes' },
  () => {
    test.describe('Single Node Actions', () => {
      test('should open node info via context menu', async ({ comfyPage }) => {
        await openContextMenu(comfyPage, 'KSampler')
        await clickExactMenuItem(comfyPage, 'Node Info')

        await expect(
          comfyPage.page.getByTestId(TestIds.propertiesPanel.root)
        ).toBeVisible()
      })

      test('should change node color via Color submenu', async ({
        comfyPage
      }) => {
        const nodeRef = await getNodeRef(comfyPage, 'KSampler')
        const initialColor = await nodeRef.getProperty<string | undefined>(
          'color'
        )

        await openContextMenu(comfyPage, 'KSampler')
        const menu = comfyPage.contextMenu.primeVueMenu
        await menu.getByRole('menuitem', { name: 'Color', exact: true }).click()

        const redSwatch = comfyPage.page.getByTitle('Red', { exact: true })
        await expect(redSwatch.first()).toBeVisible()
        await redSwatch.first().click()

        await expect
          .poll(() => nodeRef.getProperty<string | undefined>('color'))
          .not.toBe(initialColor)
      })

      test('should change node shape via Shape submenu', async ({
        comfyPage
      }) => {
        const nodeRef = await getNodeRef(comfyPage, 'KSampler')

        await openContextMenu(comfyPage, 'KSampler')
        const menu = comfyPage.contextMenu.primeVueMenu
        await menu.getByRole('menuitem', { name: 'Shape', exact: true }).hover()

        const boxItem = menu
          .getByRole('menuitem', { name: 'Box', exact: true })
          .last()
        await expect(boxItem).toBeVisible()
        await boxItem.click()

        await expect.poll(() => nodeRef.getProperty<number>('shape')).toBe(1)
      })

      test('should delete node via Delete context menu', async ({
        comfyPage
      }) => {
        const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

        await openContextMenu(comfyPage, 'KSampler')
        await clickExactMenuItem(comfyPage, 'Delete')

        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(initialCount - 1)
      })

      test('should not show Run Branch for non-output nodes', async ({
        comfyPage
      }) => {
        await openContextMenu(comfyPage, 'Load Checkpoint')
        await expect(
          comfyPage.contextMenu.primeVueMenu.getByRole('menuitem', {
            name: 'Run Branch',
            exact: true
          })
        ).toBeHidden()
      })

      test('should show Run Branch for output nodes', async ({ comfyPage }) => {
        await expect(
          comfyPage.vueNodes.getNodeByTitle('Save Image'),
          'Default workflow must contain Save Image node'
        ).toBeVisible()

        await openContextMenu(comfyPage, 'Save Image')
        await expect(
          comfyPage.contextMenu.primeVueMenu.getByRole('menuitem', {
            name: 'Run Branch',
            exact: true
          })
        ).toBeVisible()
      })
    })

    test.describe('Image Node Actions', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
        await comfyPage.vueNodes.waitForNodes(1)
        await comfyPage.page
          .locator('[data-node-id] img')
          .first()
          .waitFor({ state: 'visible' })

        const [loadImageNode] =
          await comfyPage.nodeOps.getNodeRefsByTitle('Load Image')
        if (!loadImageNode) throw new Error('Load Image node not found')

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (nodeId) =>
                window.app!.graph.getNodeById(nodeId)?.imgs?.length ?? 0,
              loadImageNode.id
            )
          )
          .toBeGreaterThan(0)
      })

      test('should open mask editor via context menu', async ({
        comfyPage
      }) => {
        await openContextMenu(comfyPage, 'Load Image')
        await clickExactMenuItem(comfyPage, 'Open in Mask Editor')

        const maskEditorDialog = comfyPage.page.locator('.mask-editor-dialog')
        await expect(maskEditorDialog).toBeVisible()
      })
    })

    test.describe('Multi-Node Actions', () => {
      const nodeTitles = ['Load Checkpoint', 'KSampler']

      test('should align selected nodes via Align Selected To submenu', async ({
        comfyPage
      }) => {
        const nodeRef0 = await getNodeRef(comfyPage, nodeTitles[0])
        const nodeRef1 = await getNodeRef(comfyPage, nodeTitles[1])

        const initialPos0 = await nodeRef0.getPosition()
        const initialPos1 = await nodeRef1.getPosition()
        expect(
          initialPos0.y !== initialPos1.y,
          'Nodes should start at different y positions'
        ).toBe(true)

        await openMultiNodeContextMenu(comfyPage, nodeTitles)
        const menu = comfyPage.contextMenu.primeVueMenu
        await menu
          .getByRole('menuitem', {
            name: 'Align Selected To',
            exact: true
          })
          .hover()

        const topItem = menu
          .getByRole('menuitem', { name: 'Top', exact: true })
          .last()
        await expect(topItem).toBeVisible()
        await topItem.click()

        await expect
          .poll(async () => {
            const pos0 = await nodeRef0.getPosition()
            const pos1 = await nodeRef1.getPosition()
            return Math.abs(pos0.y - pos1.y)
          })
          .toBeLessThanOrEqual(1)
      })

      test('should distribute selected nodes via Distribute Nodes submenu', async ({
        comfyPage
      }) => {
        const threeNodes = ['Load Checkpoint', 'KSampler', 'Empty Latent Image']

        await openMultiNodeContextMenu(comfyPage, threeNodes)
        const menu = comfyPage.contextMenu.primeVueMenu
        await menu
          .getByRole('menuitem', {
            name: 'Distribute Nodes',
            exact: true
          })
          .hover()

        const horizontalItem = menu
          .getByRole('menuitem', {
            name: 'Horizontal',
            exact: true
          })
          .last()
        await expect(horizontalItem).toBeVisible()
        await horizontalItem.click()

        const nodeRef0 = await getNodeRef(comfyPage, threeNodes[0])
        const nodeRef1 = await getNodeRef(comfyPage, threeNodes[1])
        const nodeRef2 = await getNodeRef(comfyPage, threeNodes[2])

        await expect
          .poll(async () => {
            const bounds = await Promise.all([
              nodeRef0.getBounding(),
              nodeRef1.getBounding(),
              nodeRef2.getBounding()
            ])
            const sorted = bounds.toSorted((a, b) => a.x - b.x)
            const gap1 = sorted[1].x - (sorted[0].x + sorted[0].width)
            const gap2 = sorted[2].x - (sorted[1].x + sorted[1].width)
            return Math.abs(gap1 - gap2)
          })
          .toBeLessThanOrEqual(1)
      })
    })

    test.describe('Menu Visibility Invariants', () => {
      test('should show Delete menu item for any node', async ({
        comfyPage
      }) => {
        await openContextMenu(comfyPage, 'KSampler')
        await expect(
          comfyPage.contextMenu.primeVueMenu.getByRole('menuitem', {
            name: 'Delete',
            exact: true
          })
        ).toBeVisible()
      })
    })

    test.describe('Widget Extra Options', () => {
      test('should show widget-specific options when right-clicking a named widget', async ({
        comfyPage
      }) => {
        const widgetLocator = comfyPage.vueNodes.getWidgetByName(
          'KSampler',
          'seed'
        )
        await expect(
          widgetLocator,
          'KSampler must expose a "seed" widget'
        ).toBeVisible()

        await widgetLocator.hover()
        await widgetLocator.dispatchEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2
        })

        const menu = comfyPage.contextMenu.primeVueMenu
        await menu.waitFor({ state: 'visible' })

        const menuItems = menu.getByRole('menuitem')
        const labels = await menuItems.allTextContents()
        const trimmedLabels = labels.map((l) => l.trim())

        const hasFavoriteOrRename = trimmedLabels.some(
          (label) =>
            label.startsWith('Favorite Widget') ||
            label.startsWith('Unfavorite Widget') ||
            label.startsWith('Rename Widget')
        )

        expect(
          hasFavoriteOrRename,
          'Widget-specific menu options (Favorite/Unfavorite/Rename Widget) should appear for the "seed" widget'
        ).toBe(true)
      })
    })
  }
)
