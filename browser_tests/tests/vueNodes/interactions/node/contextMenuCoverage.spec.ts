import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  openContextMenu,
  openMultiNodeContextMenu
} from '@e2e/fixtures/utils/contextMenuTestHelpers'

test.describe(
  'Vue Node Context Menu — Extended Coverage',
  { tag: '@vue-nodes' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
    })

    test.describe('Single Node Actions', () => {
      test('should change node color via Color submenu', async ({
        comfyPage
      }) => {
        const nodeRef = await comfyPage.nodeOps.getNodeRefByTitle('KSampler')
        const initialColor = await nodeRef.getProperty<string | undefined>(
          'color'
        )

        await test.step('Choose a color from the submenu', async () => {
          await openContextMenu(comfyPage, 'KSampler')
          const menu = comfyPage.contextMenu.primeVueMenu
          await menu
            .getByRole('menuitem', { name: 'Color', exact: true })
            .click()

          const redSwatch = comfyPage.page.getByTitle('Red', { exact: true })
          await expect(redSwatch.first()).toBeVisible()
          await redSwatch.first().click()
        })

        await test.step('Apply the chosen color', async () => {
          await expect
            .poll(() => nodeRef.getProperty<string | undefined>('color'))
            .not.toBe(initialColor)
        })
      })

      test('should change node shape via Shape submenu', async ({
        comfyPage
      }) => {
        const nodeRef = await comfyPage.nodeOps.getNodeRefByTitle('KSampler')

        await test.step('Choose a shape from the submenu', async () => {
          await openContextMenu(comfyPage, 'KSampler')
          const menu = comfyPage.contextMenu.primeVueMenu
          await menu
            .getByRole('menuitem', { name: 'Shape', exact: true })
            .click()

          const shapePopover = comfyPage.page
            .locator('.p-popover')
            .filter({ hasText: 'Default' })
          const boxItem = shapePopover.getByText('Box', { exact: true })
          await expect(boxItem).toBeVisible()
          await boxItem.click()
        })

        await test.step('Apply the chosen shape', async () => {
          await expect.poll(() => nodeRef.getProperty<number>('shape')).toBe(1)
        })
      })

      test('should delete node via Delete context menu', async ({
        comfyPage
      }) => {
        const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

        await openContextMenu(comfyPage, 'KSampler')
        await comfyPage.contextMenu.clickMenuItemExact('Delete')

        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(initialCount - 1)
      })

      test('should not show Run Branch for non-output nodes', async ({
        comfyPage
      }) => {
        const menu = await openContextMenu(comfyPage, 'Load Checkpoint')
        await expect(menu).toBeVisible()
        await expect(
          menu.getByRole('menuitem', {
            name: 'Run Branch',
            exact: true
          })
        ).toBeHidden()
      })

      test('should show Run Branch for output nodes', async ({ comfyPage }) => {
        const nodeRef = await comfyPage.nodeOps.getNodeRefByTitle('Save Image')
        await comfyPage.nodeOps.panToNode(nodeRef)

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
        await comfyPage.page
          .getByTestId(TestIds.node.mainImage)
          .first()
          .waitFor({ state: 'visible' })

        const loadImageNode =
          await comfyPage.nodeOps.getNodeRefByTitle('Load Image')
        await comfyPage.nodeOps.panToNode(loadImageNode)

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
        await comfyPage.contextMenu.clickMenuItemExact('Open in Mask Editor')

        await expect(
          comfyPage.page.getByRole('heading', { name: 'Mask Editor' })
        ).toBeVisible()
      })
    })

    test.describe('Multi-Node Actions', () => {
      test('should align selected nodes to the context node', async ({
        comfyPage
      }) => {
        const nodeTitles = ['KSampler', 'Load Checkpoint', 'Empty Latent Image']
        const nodeRefs = await Promise.all(
          nodeTitles.map((title) => comfyPage.nodeOps.getNodeRefByTitle(title))
        )
        const contextNode = nodeRefs[1]
        const contextNodeInitialY = (
          await contextNode.getProperty<[number, number]>('pos')
        )[1]

        expect(
          (await nodeRefs[0].getProperty<[number, number]>('pos'))[1]
        ).not.toBe(contextNodeInitialY)

        await test.step('Align selected nodes to the top of the context node', async () => {
          await openMultiNodeContextMenu(comfyPage, nodeTitles, nodeTitles[1])
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
        })

        await test.step('Align all selected nodes', async () => {
          await expect
            .poll(async () => {
              const positions = await Promise.all(
                nodeRefs.map((node) =>
                  node.getProperty<[number, number]>('pos')
                )
              )
              return positions.map((position) => position[1])
            })
            .toEqual(nodeRefs.map(() => contextNodeInitialY))
        })
      })

      test('should distribute selected nodes via Distribute Nodes submenu', async ({
        comfyPage
      }) => {
        const threeNodes = ['Load Checkpoint', 'KSampler', 'Empty Latent Image']

        await test.step('Choose horizontal distribution', async () => {
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
        })

        await test.step('Distribute selected nodes evenly', async () => {
          const nodeRefs = await Promise.all(
            threeNodes.map((title) =>
              comfyPage.nodeOps.getNodeRefByTitle(title)
            )
          )
          await expect
            .poll(async () => {
              const bounds = await Promise.all(
                nodeRefs.map((node) => node.getBounding())
              )
              const sorted = bounds.toSorted((a, b) => a.x - b.x)
              const gap1 = sorted[1].x - (sorted[0].x + sorted[0].width)
              const gap2 = sorted[2].x - (sorted[1].x + sorted[1].width)
              return Math.abs(gap1 - gap2)
            })
            .toBeLessThanOrEqual(1)
        })
      })

      test('should hide node-specific LiteGraph options for multiple nodes', async ({
        comfyPage
      }) => {
        const nodeTitle = 'KSampler'
        const node = await comfyPage.nodeOps.getNodeRefByTitle(nodeTitle)
        await comfyPage.page.evaluate((nodeId) => {
          const graphNode = window.app!.graph.getNodeById(nodeId)
          if (!graphNode) throw new Error(`Node ${nodeId} not found`)
          graphNode.getExtraMenuOptions = (_canvas, options) => [
            ...options,
            {
              content: 'Node-only action',
              callback: (_value, _options, _event, _menu, clickedNode) => {
                document.body.dataset.contextMenuNodeActionTarget =
                  clickedNode === graphNode ? 'matched' : 'mismatched'
              }
            }
          ]
        }, node.id)

        const singleNodeMenu = await openContextMenu(comfyPage, nodeTitle)
        const nodeOnlyAction = singleNodeMenu.getByRole('menuitem', {
          name: 'Node-only action',
          exact: true
        })
        await expect(nodeOnlyAction).toBeVisible()
        await nodeOnlyAction.click()
        await expect
          .poll(() =>
            comfyPage.page
              .locator('body')
              .getAttribute('data-context-menu-node-action-target')
          )
          .toBe('matched')

        const multiNodeMenu = await openMultiNodeContextMenu(comfyPage, [
          nodeTitle,
          'Load Checkpoint'
        ])
        await expect(
          multiNodeMenu.getByRole('menuitem', {
            name: 'Node-only action',
            exact: true
          })
        ).toBeHidden()
      })
    })

    test.describe('Menu Visibility Invariants', () => {
      test('should disable Delete for a non-removable node', async ({
        comfyPage
      }) => {
        const node = await comfyPage.nodeOps.getNodeRefByTitle('KSampler')
        await comfyPage.page.evaluate((nodeId) => {
          const graphNode = window.app!.graph.getNodeById(nodeId)
          if (!graphNode) throw new Error(`Node ${nodeId} not found`)
          graphNode.removable = false
        }, node.id)

        await openContextMenu(comfyPage, 'KSampler')
        await expect(
          comfyPage.contextMenu.primeVueMenu.getByRole('menuitem', {
            name: 'Delete',
            exact: true
          })
        ).toBeDisabled()
      })

      test('should disable Delete when another selected node blocks deletion', async ({
        comfyPage
      }) => {
        const protectedNode =
          await comfyPage.nodeOps.getNodeRefByTitle('KSampler')
        await comfyPage.page.evaluate((nodeId) => {
          const graphNode = window.app!.graph.getNodeById(nodeId)
          if (!graphNode) throw new Error(`Node ${nodeId} not found`)
          graphNode.block_delete = true
        }, protectedNode.id)

        const menu = await openMultiNodeContextMenu(
          comfyPage,
          ['KSampler', 'Load Checkpoint'],
          'Load Checkpoint'
        )
        await expect(
          menu.getByRole('menuitem', { name: 'Delete', exact: true })
        ).toBeDisabled()
      })
    })

    test.describe('Widget Extra Options', () => {
      test('should show widget-specific options when right-clicking a named widget', async ({
        comfyPage
      }) => {
        const nodeRef = await comfyPage.nodeOps.getNodeRefByTitle('KSampler')
        await comfyPage.nodeOps.panToNode(nodeRef)

        const widgetLocator = comfyPage.vueNodes.getWidgetByName(
          'KSampler',
          'seed'
        )
        await expect(
          widgetLocator,
          'KSampler must expose a "seed" widget'
        ).toBeVisible()

        await widgetLocator.click({ button: 'right' })

        const menu = comfyPage.contextMenu.primeVueMenu
        await menu.waitFor({ state: 'visible' })
        await expect(
          menu.getByRole('menuitem', {
            name: /^(Favorite|Unfavorite) Widget: seed$/
          })
        ).toBeVisible()
      })
    })
  }
)
