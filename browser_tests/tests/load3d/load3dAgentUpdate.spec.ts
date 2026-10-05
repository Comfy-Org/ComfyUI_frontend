import { expect } from '@playwright/test'

import { WORKSPACE_INSET_RIGHT } from '@/composables/useWorkspaceInset'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { load3dAgentTest as test } from '@e2e/fixtures/load3dAgentFixture'
import { Load3DViewerHelper } from '@e2e/tests/load3d/Load3DViewerHelper'

// The `1rem` the viewer's own width cap reserves inside the visible workspace:
// `max-w-[min(80vw,calc(100vw-var(--workspace-inset-right,0px)-1rem))]`. Not
// shared with the dialog clamp's own `0.5rem` gutter floor, which is a separate
// production value that only happens to be half of this one.
const VIEWER_CAP_RESERVE = 16

// The slack the rest of this file already allows on bounding boxes, so a
// fractional panel width or transform rounding cannot turn a correct layout
// into a failure. Note `toBeCloseTo`'s second argument is a digit count, not
// pixels, so it cannot express this.
const PIXEL_SLACK = 1

function expectPixels(actual: number, expected: number, label: string): void {
  expect(actual, label).toBeGreaterThanOrEqual(expected - PIXEL_SLACK)
  expect(actual, label).toBeLessThanOrEqual(expected + PIXEL_SLACK)
}

test.describe('Load3D agent updates', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('retires an incompatible replacement link without blocking the next agent edit', async ({
    load3dAgent
  }) => {
    await load3dAgent.expectRenderedLinks([[9, '1', 0, '2', 0, 'IMAGE']])

    load3dAgent.replaceLinkWithIncompatibleTarget()
    await load3dAgent.expectRenderedLinks([])
    load3dAgent.expectHostLink([9, 1, 0, 3, 0, 'STRING'])

    load3dAgent.setModelFromAgent('cube.obj')
    await load3dAgent.expectModel('cube.obj')
    await expect(load3dAgent.viewer.node).toBeVisible()
  })

  test('an agent model_file update refreshes the viewer and capture cache', async ({
    load3dAgent
  }) => {
    const { viewer } = load3dAgent

    const before =
      await test.step('capture the initial agent model', async () => {
        load3dAgent.setModelFromAgent('cube.obj')
        await load3dAgent.expectModel('cube.obj')
        await viewer.waitForModelLoaded()
        return load3dAgent.capture()
      })

    const after =
      await test.step('queue after the agent replacement finishes loading', async () => {
        load3dAgent.setModelFromAgent('workflow.glb')
        await load3dAgent.expectModel('workflow.glb')
        await load3dAgent.viewer.waitForModelLoaded()
        return load3dAgent.capture()
      })

    await test.step('the prompt carries the replacement model', async () => {
      expect(after.promptImage).not.toBe(before.promptImage)
      expect(after.imageBytes.byteLength).toBeGreaterThan(0)
      expect(after.imageBytes).not.toEqual(before.imageBytes)
      await expect(viewer.canvas).toBeVisible()
      await test.info().attach('agent-updated-load3d.png', {
        body: await viewer.node.screenshot(),
        contentType: 'image/png'
      })
    })
  })

  test('keeps the full-screen viewer inside the visible workspace inset', async ({
    load3dAgent,
    page
  }) => {
    const viewer = new Load3DViewerHelper(page)
    const panel = page.getByTestId('docked-agent-panel')

    await test.step('open the viewer from an agent-updated node', async () => {
      load3dAgent.setModelFromAgent('cube.obj')
      await load3dAgent.expectModel('cube.obj')
      await load3dAgent.viewer.waitForModelLoaded()
      await load3dAgent.viewer.openViewerButton.click()
      await viewer.waitForOpen()
    })

    await test.step('size the viewer against the docked panel either side of the sm breakpoint', async () => {
      // The viewer keeps its own inset-aware width cap while every other dialog
      // now resolves against the raw viewport. The cap is declared twice —
      // unprefixed and `sm:`-prefixed — because the `full` dialog size already
      // ships `sm:max-w-[calc(100vw-1rem)]`, which outranks an unprefixed cap
      // above the breakpoint. So the prefixed declaration is the live one above
      // `sm` and the unprefixed one below it, and the loop runs a viewport each
      // side so neither can drift unobserved. The pre-existing steps below only
      // bound the viewer rather than sizing it, which is why dropping the
      // prefixed declaration left them green while the viewer covered the panel.
      //
      // This dialog is always on the centring term of the clamp's `max()`,
      // never its 0.5rem gutter floor: the cap holds the width at or under
      // `100vw - inset - 1rem`, which leaves centring at least 8px, so the
      // floor can at best tie. That makes the viewer's x unusable as evidence
      // on its own, and a floor assertion here vacuous. What is asserted is
      // the width the live cap produces and equal gutters either side of the
      // viewer. The floor itself is covered by `dialogAgentPanelInset.spec.ts`,
      // where a dialog without an inset-aware cap does sit on it.
      //
      // Measure only once the open transition has finished: `waitForOpen` only
      // asserts visibility, and `data-[state=open]:zoom-in-95` would otherwise
      // put a scaled box in the trace as the first thing that failed.
      await expect
        .poll(() => viewer.dialog.evaluate((el) => el.getAnimations().length))
        .toBe(0)

      // 640 is the breakpoint itself, the narrowest viewport at which the
      // prefixed declaration is live, so it is what pins *where* that happens:
      // retarget the duplicate from `sm:` to `md:` and every wider sample
      // stays green while 640 falls back to the generic
      // `sm:max-w-[calc(100vw-1rem)]` and fails. 560 is the sub-`sm` case,
      // where the unprefixed declaration is the live one.
      //
      // Both narrow samples depend on the panel staying docked. `isOverlay`
      // compares `requestedWidth + reservedWorkspaceWidth`, so neither term is
      // a constant: the first is the dragged or maximized panel width, and the
      // second is `SIDE_TOOLBAR_WIDTH` alone here only because this fixture
      // opens no sidebar tab — with one visible it is
      // `SIDE_TOOLBAR_WIDTH + SIDEBAR_MIN_WIDTH` and 560 and 640 would overlay
      // while the three wider samples would not. The inset assertion below is
      // what holds that precondition, rather than this comment.
      const expectViewerBesidePanel = async (width: number) =>
        expect(async () => {
          const dialogBox = await viewer.dialog.boundingBox()
          const panelBox = await panel.boundingBox()
          // Read the resolved value, not the inline style the panel happens to
          // write today, and require a px length. `parseFloat(...) || 0` would
          // turn a renamed or unparseable property into the same 0 that overlay
          // mode legitimately publishes, which is the distinction the next
          // assertion exists to draw.
          const publishedInset = await page.evaluate(
            (property) =>
              getComputedStyle(document.documentElement)
                .getPropertyValue(property)
                .trim(),
            WORKSPACE_INSET_RIGHT
          )
          expect(dialogBox).not.toBeNull()
          expect(panelBox).not.toBeNull()
          if (!dialogBox || !panelBox) return

          expect(
            publishedInset,
            'the workspace inset is published as a px length'
          ).toMatch(/^-?\d+(\.\d+)?px$/)
          const inset = Number.parseFloat(publishedInset)

          // The panel is docked against the right edge, so its left edge is the
          // boundary of the visible workspace. Its width is the resizable
          // `draggedWidth`, so derive everything from the measured box rather
          // than pinning coordinates that only hold at its default width.
          expectPixels(
            panelBox.x + panelBox.width,
            width,
            'the panel is flush with the right edge'
          )

          // The panel publishes its width as the inset only while it is docked
          // and not overlaying; in overlay mode it covers the right edge with
          // an inset of 0, and the viewer is then correctly wider than the
          // workspace. Pin the mode so a failure below is attributable to the
          // viewer rather than to the panel having gone into overlay.
          expectPixels(
            inset,
            panelBox.width,
            'the docked panel publishes its width as the workspace inset'
          )

          // `min(80vw, 100vw - inset - 1rem)`. Above ~2180px at the default
          // panel width the 80vw term is the smaller one and the cap stops
          // binding, which is correct and must not fail the step.
          //
          // This is a claim about the dialog's box and nothing else. At the
          // two narrow samples the box is 124px and 204px, which is narrower
          // than the viewer's own body content, so what it contains is not
          // laid out usefully there — the canvas pane in particular collapses
          // to zero width. Pinning the box two-sided is deliberate: it is the
          // cap's contract, so a production change that gives the viewer a
          // sub-`sm` floor is a change to that contract and should surface
          // here rather than pass silently.
          expectPixels(
            dialogBox.width,
            Math.min(width * 0.8, width - inset - VIEWER_CAP_RESERVE),
            'the viewer box is the width its cap resolves to'
          )

          // Both gutters resolve against `100vw - inset`, the same boundary
          // production centres on, so the slack stays in the assertions above
          // rather than compounding into this one.
          expectPixels(
            width - inset - (dialogBox.x + dialogBox.width),
            dialogBox.x,
            'the viewer sits centred between the viewport and panel edges'
          )
        }).toPass({ timeout: 5000 })

      const resizeViewportTo = async (width: number) => {
        await page.setViewportSize({ width, height: 800 })
        // Only guarantees the box is not measured before the viewport width
        // changed — `window.innerWidth` reflects the new metrics before the
        // `resize` event dispatches, so it says nothing about whether the
        // inset publish has flushed; `toPass` is what covers that. It also
        // makes `width` legitimate ground truth for `100vw`: a headed run on a
        // narrower display gets a window-clamped viewport, which then fails
        // here naming the viewport instead of three assertions later naming
        // the viewer.
        await expect
          .poll(() => page.evaluate(() => window.innerWidth))
          .toBe(width)
      }

      // Closes the viewer first, because its modal overlay covers the handle.
      const dragPanelEdgeBy = async (dx: number) => {
        await viewer.cancelButton.click()
        await viewer.waitForClosed()
        const handleBox = await page
          .getByTestId('agent-panel-resize-handle')
          .boundingBox()
        expect(handleBox).not.toBeNull()
        if (!handleBox) throw new Error('Panel resize handle is not laid out')
        const x = handleBox.x + handleBox.width / 2
        const y = handleBox.y + handleBox.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + dx, y, { steps: 10 })
        await page.mouse.up()
      }

      const reopenViewer = async () => {
        await load3dAgent.viewer.openViewerButton.click()
        await viewer.waitForOpen()
        await expect
          .poll(() => viewer.dialog.evaluate((el) => el.getAnimations().length))
          .toBe(0)
      }

      for (const width of [1280, 1920, 2560, 640, 560]) {
        await resizeViewportTo(width)
        await expectViewerBesidePanel(width)
      }

      // Every iteration above leaves the panel at its default 420px, so the
      // inset term in the viewer's cap and a hard-coded `420px` would be
      // indistinguishable — including to the inset assertion itself, which is
      // tautological while the width never varies. Drag the panel wider and
      // re-measure: at a 1920px viewport that regression would render the
      // viewer at 1484px instead of 1284px and overlap the panel by 200px.
      //
      // The viewer has to be closed to do it. It is modal, and its overlay is
      // `fixed inset-0`, so the panel's resize handle is genuinely unreachable
      // by a pointer while the viewer is open.
      await resizeViewportTo(1920)
      await dragPanelEdgeBy(-200)
      await expect
        .poll(async () => Math.round((await panel.boundingBox())?.width ?? 0))
        .toBe(620)
      await reopenViewer()
      await expectViewerBesidePanel(1920)

      // Restore the default width: the narrow steps below are written against
      // a 420px panel, and a 620px one overlays at their viewports.
      await dragPanelEdgeBy(200)
      await expect
        .poll(async () => Math.round((await panel.boundingBox())?.width ?? 0))
        .toBe(420)
      await reopenViewer()
    })

    await test.step('keep the viewer outside the docked Agent panel', async () => {
      await page.setViewportSize({ width: 500, height: 800 })

      const viewport = page.viewportSize()
      expect(viewport).not.toBeNull()
      if (!viewport) throw new Error('Viewport size not available')

      await expect(async () => {
        const dialogBox = await viewer.dialog.boundingBox()
        const panelBox = await panel.boundingBox()
        expect(dialogBox).not.toBeNull()
        expect(panelBox).not.toBeNull()
        if (!dialogBox || !panelBox) return

        expect(dialogBox.x).toBeGreaterThanOrEqual(0)
        expect(dialogBox.y).toBeGreaterThanOrEqual(0)
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(
          panelBox.x + 1
        )
        expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
          viewport.height + 1
        )
      }).toPass({ timeout: 5000 })
    })

    await test.step('keep both overlays inside the narrow viewport', async () => {
      await page.setViewportSize({ width: 400, height: 800 })
      await expect(panel).toBeVisible()
      await expect(panel).toHaveCSS('position', 'fixed')
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.style.getPropertyValue(
              '--workspace-inset-right'
            )
          )
        )
        .toBe('0px')
      await expect(async () => {
        const dialogBox = await viewer.dialog.boundingBox()
        const panelBox = await panel.boundingBox()
        expect(dialogBox).not.toBeNull()
        expect(panelBox).not.toBeNull()
        if (!dialogBox || !panelBox) return

        expect(dialogBox.width).toBeGreaterThan(0)
        expect(dialogBox.x).toBeGreaterThanOrEqual(0)
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(401)
        expect(panelBox.width).toBeGreaterThan(0)
        expect(panelBox.x).toBeGreaterThanOrEqual(0)
        expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(401)
      }).toPass({ timeout: 5000 })
    })

    await test.step('restore the viewer and Agent panel controls', async () => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await viewer.cancelButton.click()
      await viewer.waitForClosed()

      const agentPanel = new AgentPanel(page)
      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await agentPanel.openButton.click()
      await expect(agentPanel.root).toBeHidden()
      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      await agentPanel.open()
    })
  })
})
