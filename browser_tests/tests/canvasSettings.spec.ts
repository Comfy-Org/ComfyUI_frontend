import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { sleep } from '@e2e/fixtures/utils/timing'

const CLIP_NODE_COUNT = 2

const getClipNodesDragBox = async (comfyPage: ComfyPage) => {
  const clipNodes = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
  expect(
    clipNodes,
    'Default workflow is expected to contain exactly two CLIPTextEncode nodes'
  ).toHaveLength(CLIP_NODE_COUNT)
  const p1 = await clipNodes[0].getPosition()
  const p2 = await clipNodes[1].getPosition()
  const margin = 64
  const from = await comfyPage.canvasOps.toAbsolute({
    x: Math.min(p1.x, p2.x) - margin,
    y: Math.min(p1.y, p2.y) - margin
  })
  const to = await comfyPage.canvasOps.toAbsolute({
    x: Math.max(p1.x, p2.x) + margin,
    y: Math.max(p1.y, p2.y) + margin
  })
  return { from, to }
}

test.describe('Canvas settings', { tag: '@canvas' }, () => {
  test.describe('Comfy.Graph.CanvasInfo', () => {
    test(
      'toggles the bottom-left HUD',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        const box = await comfyPage.canvas.boundingBox()
        expect(box, 'Canvas bounding box must be available').not.toBeNull()
        // HUD is drawn ~80px tall along the bottom edge of the canvas; grab a
        // comfortable 180px × 160px strip to catch it across viewports.
        const HUD_WIDTH = 180
        const HUD_HEIGHT = 160
        const hudClip = {
          x: box!.x,
          y: box!.y + box!.height - HUD_HEIGHT,
          width: HUD_WIDTH,
          height: HUD_HEIGHT
        }

        await test.step('Capture HUD region with setting off', async () => {
          await comfyPage.settings.setSetting('Comfy.Graph.CanvasInfo', false)
          await comfyPage.canvasOps.resetView()
          await comfyPage.canvasOps.moveMouseToEmptyArea()
          await expect(comfyPage.page).toHaveScreenshot(
            'canvas-info-hud-off.png',
            { clip: hudClip, maxDiffPixels: 50 }
          )
        })

        await test.step('Capture HUD region with setting on', async () => {
          await comfyPage.settings.setSetting('Comfy.Graph.CanvasInfo', true)
          await comfyPage.canvasOps.moveMouseToEmptyArea()
          await expect(comfyPage.page).toHaveScreenshot(
            'canvas-info-hud-on.png',
            { clip: hudClip, maxDiffPixels: 50 }
          )
        })
      }
    )
  })

  test.describe('Comfy.Graph.CtrlShiftZoom', () => {
    const CTRL_SHIFT_DRAG_FROM = { x: 100, y: 100 }
    const CTRL_SHIFT_DRAG_TO = { x: 400, y: 400 }

    test('Ctrl+Shift+drag zooms canvas when enabled', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Graph.CtrlShiftZoom', true)
      await comfyPage.canvasOps.resetView()
      const initialScale = await comfyPage.canvasOps.getScale()

      await comfyPage.canvasOps.ctrlShiftDrag(
        CTRL_SHIFT_DRAG_FROM,
        CTRL_SHIFT_DRAG_TO
      )

      await expect
        .poll(() => comfyPage.canvasOps.getScale())
        .not.toBeCloseTo(initialScale, 2)
    })

    test('Ctrl+Shift+drag does not zoom when disabled', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Graph.CtrlShiftZoom', false)
      await comfyPage.canvasOps.resetView()
      const initialScale = await comfyPage.canvasOps.getScale()

      await comfyPage.canvasOps.ctrlShiftDrag(
        CTRL_SHIFT_DRAG_FROM,
        CTRL_SHIFT_DRAG_TO
      )

      expect(await comfyPage.canvasOps.getScale()).toBeCloseTo(initialScale, 2)
    })
  })

  test.describe('Comfy.Graph.LiveSelection', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Canvas.NavigationMode',
        'standard'
      )
    })

    test('selects nodes mid-drag when enabled', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Graph.LiveSelection', true)
      const { from, to } = await getClipNodesDragBox(comfyPage)

      await comfyPage.page.mouse.move(from.x, from.y)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(to.x, to.y, { steps: 10 })

      await expect
        .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
        .toBe(CLIP_NODE_COUNT)

      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()
    })

    test('defers selection to drag end when disabled', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Graph.LiveSelection', false)
      const { from, to } = await getClipNodesDragBox(comfyPage)

      await comfyPage.page.mouse.move(from.x, from.y)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(to.x, to.y, { steps: 10 })
      expect(await comfyPage.nodeOps.getSelectedGraphNodesCount()).toBe(0)

      await comfyPage.page.mouse.up()
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
        .toBe(CLIP_NODE_COUNT)
    })
  })

  test.describe('Comfy.Graph.WheelInputMode', () => {
    const WHEEL_POS = { x: 400, y: 400 }

    test('wheel zooms when input device is mouse', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Graph.WheelInputMode', 'mouse')
      const initialScale = await comfyPage.canvasOps.getScale()

      await comfyPage.page.mouse.move(WHEEL_POS.x, WHEEL_POS.y)
      await comfyPage.page.mouse.wheel(0, -120)
      await comfyPage.page.mouse.wheel(0, -120)
      await comfyPage.nextFrame()

      expect(await comfyPage.canvasOps.getScale()).not.toBeCloseTo(
        initialScale,
        3
      )
    })

    test('wheel pans when input device is trackpad', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Graph.WheelInputMode',
        'trackpad'
      )
      const initialScale = await comfyPage.canvasOps.getScale()
      const initialOffset = await comfyPage.canvasOps.getOffset()

      await comfyPage.page.mouse.move(WHEEL_POS.x, WHEEL_POS.y)
      await comfyPage.page.mouse.wheel(0, 120)
      await comfyPage.page.mouse.wheel(0, 120)
      await comfyPage.nextFrame()

      expect(await comfyPage.canvasOps.getScale()).toBeCloseTo(initialScale, 3)
      const offset = await comfyPage.canvasOps.getOffset()
      expect(
        Math.abs(offset[0] - initialOffset[0]) +
          Math.abs(offset[1] - initialOffset[1])
      ).toBeGreaterThan(1)
    })
  })

  test.describe('Comfy.Canvas.LeftMouseClickBehavior', () => {
    test('override to panning makes empty left-drag pan the canvas', async ({
      comfyPage
    }) => {
      await test.step("Flip to 'select' then back to 'panning' (NavigationMode→custom)", async () => {
        await comfyPage.settings.setSetting(
          'Comfy.Canvas.LeftMouseClickBehavior',
          'select'
        )
        await comfyPage.settings.setSetting(
          'Comfy.Canvas.LeftMouseClickBehavior',
          'panning'
        )
      })

      await comfyPage.canvasOps.resetView()

      const initialOffset = await comfyPage.canvasOps.getOffset()
      await comfyPage.canvasOps.dragAndDrop(
        { x: 200, y: 300 },
        { x: 400, y: 500 }
      )
      const offset = await comfyPage.canvasOps.getOffset()

      expect(
        Math.abs(offset[0] - initialOffset[0]) +
          Math.abs(offset[1] - initialOffset[1])
      ).toBeGreaterThan(50)
      expect(await comfyPage.nodeOps.getSelectedGraphNodesCount()).toBe(0)
    })

    test('override to select turns empty left-drag into a selection rectangle', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Canvas.LeftMouseClickBehavior',
        'select'
      )
      const { from, to } = await getClipNodesDragBox(comfyPage)

      await comfyPage.canvasOps.dragAndDrop(from, to)

      await expect
        .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
        .toBe(CLIP_NODE_COUNT)
    })
  })

  test.describe('Pointer settings', () => {
    /**
     * Press left-mouse at canvas-relative `pos`, hold for `holdMs` (0 = no
     * hold), nudge by `(dx, dy)` absolute pixels, then release. Spec-local
     * because it exists only to probe the CanvasPointer timing thresholds.
     */
    const holdDragAt = async (
      comfyPage: ComfyPage,
      pos: { x: number; y: number },
      opts: { dx: number; dy: number; holdMs: number }
    ) => {
      const abs = await comfyPage.canvasOps.toAbsolute(pos)
      await comfyPage.page.mouse.move(abs.x, abs.y)
      await comfyPage.page.mouse.down()
      await sleep(opts.holdMs)
      await comfyPage.page.mouse.move(abs.x + opts.dx, abs.y + opts.dy)
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()
    }

    test('DoubleClickTime controls whether two clicks open the title editor', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Node.DoubleClickTitleToEdit',
        true
      )
      const clipNodes =
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      expect(
        clipNodes,
        'Default workflow must have CLIPTextEncode nodes'
      ).toHaveLength(CLIP_NODE_COUNT)
      const titlePos = await clipNodes[0].getTitlePosition()
      const CLICK_GAP_MS = 200

      await test.step(`Gap (${CLICK_GAP_MS}ms) exceeds DoubleClickTime → editor stays hidden`, async () => {
        await comfyPage.settings.setSetting(
          'Comfy.Pointer.DoubleClickTime',
          100
        )
        await comfyPage.canvasOps.mouseClickAt(titlePos)
        await sleep(CLICK_GAP_MS)
        await comfyPage.canvasOps.mouseClickAt(titlePos)
        await comfyPage.titleEditor.expectHidden()
      })

      await test.step(`Gap (${CLICK_GAP_MS}ms) within DoubleClickTime → editor opens`, async () => {
        await comfyPage.settings.setSetting(
          'Comfy.Pointer.DoubleClickTime',
          1000
        )
        await comfyPage.canvasOps.mouseClickAt(titlePos)
        await sleep(CLICK_GAP_MS)
        await comfyPage.canvasOps.mouseClickAt(titlePos)
        await comfyPage.titleEditor.expectVisible()
      })
    })

    test('ClickBufferTime governs the click-vs-drag time threshold', async ({
      comfyPage
    }) => {
      // Keep drift generous so only elapsed time distinguishes click vs drag.
      await comfyPage.settings.setSetting('Comfy.Pointer.ClickDrift', 20)
      const node = (
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )[0]
      const titlePos = await node.getTitlePosition()
      const NUDGE = 2
      const HOLD_MS = 250

      await test.step(`Buffer=2000ms (hold=${HOLD_MS}ms within buffer) → click, node stays put`, async () => {
        await comfyPage.settings.setSetting(
          'Comfy.Pointer.ClickBufferTime',
          2000
        )
        const before = await node.getPosition()
        await holdDragAt(comfyPage, titlePos, {
          dx: NUDGE,
          dy: NUDGE,
          holdMs: HOLD_MS
        })
        const after = await node.getPosition()
        expect(after.x).toBeCloseTo(before.x, 0)
        expect(after.y).toBeCloseTo(before.y, 0)
      })

      await test.step(`Buffer=50ms (hold=${HOLD_MS}ms exceeds buffer) → drag, node moves`, async () => {
        await comfyPage.settings.setSetting('Comfy.Pointer.ClickBufferTime', 50)
        const before = await node.getPosition()
        await holdDragAt(comfyPage, titlePos, {
          dx: NUDGE,
          dy: NUDGE,
          holdMs: HOLD_MS
        })
        const after = await node.getPosition()
        expect(
          Math.abs(after.x - before.x) + Math.abs(after.y - before.y)
        ).toBeGreaterThan(0)
      })
    })

    test('ClickDrift governs the click-vs-drag distance threshold', async ({
      comfyPage
    }) => {
      // Keep buffer generous so only drift distance matters.
      await comfyPage.settings.setSetting('Comfy.Pointer.ClickBufferTime', 2000)
      const node = (
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )[0]
      const titlePos = await node.getTitlePosition()
      const NUDGE = 8

      await test.step(`Drift=20px (nudge=${NUDGE}px within tolerance) → click, node stays put`, async () => {
        await comfyPage.settings.setSetting('Comfy.Pointer.ClickDrift', 20)
        const before = await node.getPosition()
        await holdDragAt(comfyPage, titlePos, {
          dx: NUDGE,
          dy: NUDGE,
          holdMs: 0
        })
        const after = await node.getPosition()
        expect(after.x).toBeCloseTo(before.x, 0)
        expect(after.y).toBeCloseTo(before.y, 0)
      })

      await test.step(`Drift=1px (nudge=${NUDGE}px exceeds tolerance) → drag, node moves`, async () => {
        await comfyPage.settings.setSetting('Comfy.Pointer.ClickDrift', 1)
        const before = await node.getPosition()
        await holdDragAt(comfyPage, titlePos, {
          dx: NUDGE,
          dy: NUDGE,
          holdMs: 0
        })
        const after = await node.getPosition()
        expect(
          Math.abs(after.x - before.x) + Math.abs(after.y - before.y)
        ).toBeGreaterThan(0)
      })
    })
  })

  test.describe('LiteGraph.Canvas.MaximumFps', () => {
    // Behavioural FPS counting via rAF is not reliable under Playwright
    // (CI jitter, background throttling, canvas-idle behaviour). Assert the
    // render-loop throttle value instead — that is what actually governs
    // frame cadence.
    const getFrameGap = (comfyPage: ComfyPage) =>
      comfyPage.page.evaluate(() => window.app!.canvas.maximumFps * 1000)

    test('caps the render loop frame gap', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('LiteGraph.Canvas.MaximumFps', 30)
      await expect.poll(() => getFrameGap(comfyPage)).toBeCloseTo(1000 / 30, 1)

      await comfyPage.settings.setSetting('LiteGraph.Canvas.MaximumFps', 60)
      await expect.poll(() => getFrameGap(comfyPage)).toBeCloseTo(1000 / 60, 1)

      await comfyPage.settings.setSetting('LiteGraph.Canvas.MaximumFps', 0)
      await expect.poll(() => getFrameGap(comfyPage)).toBe(0)
    })
  })
})
