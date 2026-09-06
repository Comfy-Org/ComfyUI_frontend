import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'
import {
  groupBounds,
  nodeZIndex,
  pressMoveRelease,
  titleCenter
} from '@e2e/fixtures/utils/selectionGestures'

test.describe(
  'Pointer gesture contract',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.Canvas.SelectionToolbox': true,
        'Comfy.Canvas.NavigationMode': 'standard',
        'Comfy.Pointer.ClickDrift': 6,
        'Comfy.Pointer.ClickBufferTime': 32,
        'LiteGraph.Group.SelectChildrenOnClick': false,
        'Comfy.Graph.LiveSelection': false
      }
    })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('selection/three-nodes-and-group')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(3)
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('slow group-title click selects without moving the group', async ({
      comfyPage
    }) => {
      const title = await getGroupTitlePosition(comfyPage, 'Pair')
      const before = await groupBounds(comfyPage, 'Pair')
      await expect(comfyPage.selectionToolbox).toBeHidden()

      await pressMoveRelease(comfyPage, title, { x: 1, y: 0 }, 150)

      await expect(comfyPage.selectionToolbox).toBeVisible()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
      test.fail(
        true,
        'FE-2040 / time-based promotion moves the group after 150 ms and 1 px of drift'
      )
      await expect.poll(() => groupBounds(comfyPage, 'Pair')).toEqual(before)
    })

    test('slow empty-canvas click clears selection without panning', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      await a.title.click()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
      const before = await a.boundingBox()
      const empty = await comfyPage.canvasOps.toAbsolute({ x: 100, y: 100 })

      await pressMoveRelease(comfyPage, empty, { x: 1, y: 0 }, 150)

      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
      await expect(comfyPage.selectionToolbox).toBeHidden()
      await expect.poll(() => a.boundingBox()).toEqual(before)
    })

    test('node-title movement below ClickDrift is a click', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const title = await titleCenter(a.title)
      const before = await a.boundingBox()

      await pressMoveRelease(comfyPage, title, { x: 4, y: 0 })

      await expect(comfyPage.vueNodes.selectedNodes).toHaveAttribute(
        'data-node-id',
        '1'
      )
      test.fail(
        true,
        'FE-2040 / Vue nodes drag at 3 px instead of the configured 6 px ClickDrift'
      )
      await expect.poll(() => a.boundingBox()).toEqual(before)
    })

    test('group-title movement below ClickDrift is a click', async ({
      comfyPage
    }) => {
      const title = await getGroupTitlePosition(comfyPage, 'Pair')
      const before = await groupBounds(comfyPage, 'Pair')

      await pressMoveRelease(comfyPage, title, { x: 4, y: 0 })

      await expect(comfyPage.selectionToolbox).toBeVisible()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)
      await expect.poll(() => groupBounds(comfyPage, 'Pair')).toEqual(before)
    })

    test('node-title movement above ClickDrift drags the node', async ({
      comfyPage
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const title = await titleCenter(a.title)
      const before = await a.boundingBox()
      if (!before) throw new Error('Node A must be rendered')

      await pressMoveRelease(comfyPage, title, { x: 12, y: 0 })

      await expect(comfyPage.vueNodes.selectedNodes).toHaveAttribute(
        'data-node-id',
        '1'
      )
      await expect
        .poll(() => a.boundingBox())
        .toEqual({
          ...before,
          x: before.x + 12
        })
    })

    test('group-title movement above ClickDrift drags the group', async ({
      comfyPage
    }) => {
      const title = await getGroupTitlePosition(comfyPage, 'Pair')
      const before = await groupBounds(comfyPage, 'Pair')

      await pressMoveRelease(comfyPage, title, { x: 12, y: 0 })

      await expect(comfyPage.selectionToolbox).toBeVisible()
      await expect
        .poll(() => groupBounds(comfyPage, 'Pair'))
        .toEqual({
          ...before,
          x: before.x + 12
        })
    })

    test('pressing an unselected unpinned node brings it to front before release', async ({
      comfyPage,
      comfyMouse
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const b = await comfyPage.vueNodes.getFixtureByTitle('Node B')
      await b.title.click()
      const front = await nodeZIndex(b.root)
      expect(await nodeZIndex(a.root)).toBeLessThan(front)
      await expect(a.pinIndicator).toBeHidden()
      await a.title.hover()

      await using press = await comfyMouse.hold()
      await comfyPage.nextFrame()

      test.fail(
        true,
        'FE-2040 / Vue nodes are brought to front on release, not on press'
      )
      await expect.poll(() => nodeZIndex(a.root)).toBeGreaterThan(front)
      await press.disposeAsync()
    })

    test('pressing an unselected pinned node preserves its stacking order', async ({
      comfyPage,
      comfyMouse
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const b = await comfyPage.vueNodes.getFixtureByTitle('Node B')
      await a.title.click()
      await comfyPage.page.keyboard.press('p')
      await expect(a.pinIndicator).toBeVisible()
      await b.title.click()
      const before = await nodeZIndex(a.root)
      expect(before).toBeLessThan(await nodeZIndex(b.root))
      await a.title.hover()

      await using press = await comfyMouse.hold()
      await comfyPage.nextFrame()

      await expect.poll(() => nodeZIndex(a.root)).toBe(before)
      await press.disposeAsync()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveAttribute(
        'data-node-id',
        '1'
      )
      await expect.poll(() => nodeZIndex(a.root)).toBe(before)
    })

    test('Space release preserves a previously locked canvas', async ({
      comfyPage,
      comfyMouse
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const b = await comfyPage.vueNodes.getFixtureByTitle('Node B')
      await comfyPage.canvasOps.click({ x: 100, y: 100 })
      await comfyPage.page.keyboard.press('h')
      await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(true)
      const aBefore = await a.boundingBox()
      const bBefore = await b.boundingBox()
      if (!aBefore || !bBefore) throw new Error('Both nodes must be rendered')

      await comfyPage.page.keyboard.press('Space')
      await comfyMouse.dragElementBy(a.title, { x: 80, y: 0 })

      test.fail(
        true,
        'FE-2040 / Space keyup clears the pre-existing read-only state'
      )
      await expect
        .poll(async () => {
          const aAfter = await a.boundingBox()
          const bAfter = await b.boundingBox()
          if (!aAfter || !bAfter) throw new Error('Both nodes must be rendered')
          return { x: aAfter.x - bAfter.x, y: aAfter.y - bAfter.y }
        }, 'Locked drag may pan but must not move A relative to B')
        .toEqual({ x: aBefore.x - bBefore.x, y: aBefore.y - bBefore.y })
    })

    test('right press on an unselected node replaces multi-selection and opens its menu', async ({
      comfyPage,
      comfyMouse
    }) => {
      const a = await comfyPage.vueNodes.getFixtureByTitle('Node A')
      const b = await comfyPage.vueNodes.getFixtureByTitle('Node B')
      const c = await comfyPage.vueNodes.getFixtureByTitle('Node C')
      await a.title.click()
      await b.title.click({ modifiers: ['Shift'] })
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
      await c.title.hover()

      await using press = await comfyMouse.hold({ button: 'right' })
      await comfyPage.nextFrame()

      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
      await expect(comfyPage.vueNodes.selectedNodes).toHaveAttribute(
        'data-node-id',
        '3'
      )
      await expect(comfyPage.contextMenu.primeVueMenu).toBeVisible()
      await expect(comfyPage.contextMenu.menuItem('Pin')).toBeVisible()
      await press.disposeAsync()
    })
  }
)
