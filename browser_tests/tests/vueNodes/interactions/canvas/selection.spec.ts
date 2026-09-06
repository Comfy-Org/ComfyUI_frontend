import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'
import { marqueeAround } from '@e2e/fixtures/utils/selectionGestures'

test.describe(
  'Vue selection characterization',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.Canvas.SelectionToolbox': true,
        'Comfy.Canvas.NavigationMode': 'standard',
        'Comfy.Pointer.ClickDrift': 6,
        'LiteGraph.Group.SelectChildrenOnClick': false,
        'Comfy.Graph.LiveSelection': false
      }
    })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('selection/three-nodes-and-group')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(3)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('plain title click replaces the previous node selection', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const b = await comfyPage.vueNodes.getFixtureByTitle('Node B')

      await a.title.click()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveAttribute(
        'data-node-id',
        '1'
      )
      await b.title.click()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveAttribute(
        'data-node-id',
        '2'
      )
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
    })

    test('shift-click adds a node and shows the multi-selection toolbox', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const b = await comfyPage.vueNodes.getFixtureByTitle('Node B')

      await a.title.click()
      await b.title.click({ modifiers: ['Shift'] })

      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
      await expect(a.root).toHaveClass(/outline-node-component-outline/)
      await expect(b.root).toHaveClass(/outline-node-component-outline/)
      await expect(comfyPage.selectionToolbox).toBeVisible()
    })

    test('control-click removes only the clicked selected node', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const b = await comfyPage.vueNodes.getFixtureByTitle('Node B')

      await a.title.click()
      await b.title.click({ modifiers: ['Shift'] })
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
      await a.title.click({ modifiers: ['Control'] })

      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
      await expect(comfyPage.vueNodes.selectedNodes).toHaveAttribute(
        'data-node-id',
        '2'
      )
    })

    test('empty canvas click clears Ctrl+A selection and hides the toolbox', async ({
      comfyPage
    }) => {
      await comfyPage.canvasOps.click({ x: 100, y: 100 })
      await comfyPage.keyboard.selectAll()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(3)
      await expect(comfyPage.selectionToolbox).toBeVisible()

      await comfyPage.canvasOps.click({ x: 100, y: 100 })

      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
      await expect(comfyPage.selectionToolbox).toBeHidden()
    })

    test('marquee selects enclosed nodes and replaces the previous selection', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const pair = comfyPage.vueNodes.getNodeByTitle(/^Node [BC]$/)

      await a.title.click()
      await marqueeAround(comfyPage, pair)
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
      await expect(a.root).not.toHaveClass(/outline-node-component-outline/)
      await expect(comfyPage.selectionToolbox).toBeVisible()
    })

    test('shift-marquee adds enclosed nodes to the existing selection', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const pair = comfyPage.vueNodes.getNodeByTitle(/^Node [BC]$/)

      await a.title.click()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)

      await comfyPage.canvas.focus()
      await using shift = await comfyPage.keyboard.hold('Shift')
      await marqueeAround(comfyPage, pair)
      await shift.disposeAsync()

      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(3)
    })

    test('dragging an unselected node replaces selection and moves only that node', async ({
      comfyPage,
      comfyMouse
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const b = await comfyPage.vueNodes.getFixtureByTitle('Node B')
      const c = await comfyPage.vueNodes.getFixtureByTitle('Node C')
      await a.title.click()
      await c.title.click({ modifiers: ['Shift'] })
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
      const aBefore = await a.boundingBox()
      const bBefore = await b.boundingBox()
      const cBefore = await c.boundingBox()
      if (!aBefore || !bBefore || !cBefore)
        throw new Error('All three nodes must be rendered before dragging')

      await comfyMouse.dragElementBy(b.title, { x: 80, y: 40 })

      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
      await expect(comfyPage.vueNodes.selectedNodes).toHaveAttribute(
        'data-node-id',
        '2'
      )
      await expect(a.root).toHaveBounds(aBefore)
      await expect(c.root).toHaveBounds(cBefore)
      await expect(b.root).toHaveBounds({
        ...bBefore,
        x: bBefore.x + 80,
        y: bBefore.y + 40
      })
    })

    test('group title selects only the group when child selection is disabled', async ({
      comfyPage
    }) => {
      const title = await getGroupTitlePosition(comfyPage, 'Pair')
      await comfyPage.page.mouse.click(title.x, title.y)
      await comfyPage.nextFrame()

      await expect(comfyPage.selectionToolbox).toBeVisible()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() =>
            [...window.app!.canvas.selectedItems].map((item) => item.id)
          )
        )
        .toEqual([1])
    })

    test.describe('group child cascade', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'LiteGraph.Group.SelectChildrenOnClick',
          true
        )
      })

      test('shift-toggling a group off also deselects its cascaded children', async ({
        comfyPage
      }) => {
        const title = await getGroupTitlePosition(comfyPage, 'Pair')
        await comfyPage.page.mouse.click(title.x, title.y)
        await comfyPage.nextFrame()
        await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
        await expect(comfyPage.vueNodes.getNodeLocator('1')).not.toHaveClass(
          /outline-node-component-outline/
        )
        await expect(comfyPage.selectionToolbox).toBeVisible()

        await comfyPage.canvas.focus()
        await using shift = await comfyPage.keyboard.hold('Shift')
        await comfyPage.page.mouse.click(title.x + 80, title.y)
        await comfyPage.nextFrame()
        await shift.disposeAsync()

        test.fail(
          true,
          'FE-2040 / #7454: toggling a group off leaves its cascaded children selected'
        )
        await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
        await expect(comfyPage.selectionToolbox).toBeHidden()
      })

      test('right-click replaces child selection with the Vue group menu', async ({
        comfyPage
      }) => {
        await comfyPage.vueNodes.selectNodes(['2', '3'])
        await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
        const title = await getGroupTitlePosition(comfyPage, 'Pair')
        await comfyPage.page.mouse.click(title.x, title.y, { button: 'right' })
        await comfyPage.nextFrame()

        await expect(comfyPage.contextMenu.primeVueMenu).toBeVisible()
        await expect(
          comfyPage.contextMenu.menuItem('Fit Group To Nodes')
        ).toBeVisible()
        await expect(comfyPage.contextMenu.litegraphContextMenu).toBeHidden()
        await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() =>
              [...window.app!.canvas.selectedItems].map((item) => item.id)
            )
          )
          .toEqual([1])

        await expect(
          comfyPage.contextMenu.primeVueMenu.getByRole('menubar')
        ).toBeFocused()
        await comfyPage.page.keyboard.press('Escape')
        await comfyPage.contextMenu.waitForHidden()
      })
    })

    test('switching workflow tabs leaves no selection from the previous workflow', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      await a.title.click()
      await expect(comfyPage.selectionToolbox).toBeVisible()
      await comfyPage.workflow.switchToTab('Unsaved Workflow')

      await expect(a.root.getByTestId('node-title')).toBeHidden()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
      await expect(comfyPage.selectionToolbox).toBeHidden()
    })

    test.describe('subgraph boundary', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
      })

      test('subgraph selection does not leak back to the parent', async ({
        comfyPage
      }) => {
        await comfyPage.vueNodes.enterSubgraph('11')
        const inner = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        await inner.title.click()
        await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
        await expect(comfyPage.selectionToolbox).toBeVisible()

        await comfyPage.page.getByTestId(TestIds.breadcrumb.back).click()
        await comfyPage.nextFrame()
        await expect(
          comfyPage.vueNodes.getNodeByTitle('New Subgraph')
        ).toBeVisible()
        await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
        await expect(comfyPage.selectionToolbox).toBeHidden()
      })
    })
  }
)
