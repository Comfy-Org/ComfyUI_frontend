import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import type { NodeId } from '@/types/nodeId'

/**
 * PM-1304 / PM-1312: a Flux2ImageNode (or any node using the autogrow
 * dynamic-widget system) can only be resized LARGER, never smaller, once its
 * content has required more height. Switching browser tabs away and back
 * re-triggers a shared measurement pipeline that re-applies this "can't
 * shrink" ratchet to EVERY such node on the canvas at once, not just the one
 * touched.
 *
 * Root cause (see graphLayoutAttachment.ts `refreshNodeGeometry` and
 * useVueNodeResizeTracking.ts): the rendered node size is computed as
 * `Math.max(explicitSize, contentSize)`, a floor that never decreases, and
 * `contentSize` is tracked by a single module-level singleton `ResizeObserver`
 * shared by every Vue node. On tab-hide it wipes cached measurements for
 * deferred nodes; on tab-visible it force-remeasures all of them in one
 * batch, re-latching the ratchet across every node sharing the observer.
 */
test.describe(
  'Vue Node resize ratchet on autogrow content growth',
  { tag: ['@vue-nodes', '@canvas', '@node', '@screenshot'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    /**
     * Selects the "Flux.2 [pro]" option on a Flux2ImageNode's dynamic-combo
     * `model` widget, exposing its `width`/`height`/`images` (autogrow)
     * inputs. Mirrors the production widget-value setter interaction path
     * (`dynamicComboWidget` in dynamicWidgets.ts), not a test-only shortcut.
     */
    async function selectFluxModel(
      comfyPage: ComfyPage,
      nodeId: NodeId
    ): Promise<void> {
      await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found`)
        const modelWidget = node.widgets?.find((w) => w.name === 'model')
        if (!modelWidget) throw new Error('model widget not found')
        modelWidget.value = 'Flux.2 [pro]'
        modelWidget.callback?.(modelWidget.value)
      }, nodeId)
    }

    /** Connects a LoadImage node's IMAGE output to the next empty autogrow
     * reference-image slot on a Flux2ImageNode, using the real LiteGraph
     * connect() path (exercises the same autogrow onConnectionsChange
     * production code a canvas drag would). */
    async function connectNextReferenceImage(
      comfyPage: ComfyPage,
      fluxNodeId: NodeId,
      loadImageNodeId: NodeId
    ): Promise<void> {
      await comfyPage.page.evaluate(
        ({ fluxNodeId, loadImageNodeId }) => {
          const graph = window.app!.canvas.graph!
          const fluxNode = graph.getNodeById(fluxNodeId)
          const loadImage = graph.getNodeById(loadImageNodeId)
          if (!fluxNode || !loadImage) throw new Error('Node not found')
          const slotIndex = fluxNode.inputs.findIndex(
            (input) =>
              input.name.startsWith('model.images.image_') && !input.link
          )
          if (slotIndex === -1)
            throw new Error('No empty reference-image slot found')
          loadImage.connect(0, fluxNode, slotIndex)
        },
        { fluxNodeId, loadImageNodeId }
      )
    }

    test.fail(
      'cannot shrink a node below content height it once grew to fit (PM-1304)',
      async ({ comfyPage }) => {
        const flux = await comfyPage.nodeOps.addNode(
          'Flux2ImageNode',
          undefined,
          { x: 500, y: 100 }
        )
        const loadImage = await comfyPage.nodeOps.addNode(
          'LoadImage',
          undefined,
          { x: 50, y: 100 }
        )
        await comfyPage.nextFrame()
        await selectFluxModel(comfyPage, flux.id)
        await comfyPage.nextFrame()

        const node = new VueNodeFixture(
          comfyPage.vueNodes.getNodeLocator(String(flux.id))
        )
        await expect(node.root).toBeVisible()

        const baseline = (await node.boundingBox())!

        // Connecting the first reference image appends a new empty autogrow
        // slot, growing the node's real DOM content beyond its current
        // explicit size.
        await connectNextReferenceImage(comfyPage, flux.id, loadImage.id)
        await comfyPage.nextFrame()

        const getHeight = async () => (await node.boundingBox())?.height ?? -1
        await expect.poll(getHeight).toBeGreaterThan(baseline.height)
        const grownHeight = await getHeight()

        await expect(node.root).toHaveScreenshot(
          'flux-node-grown-before-shrink-attempt.png'
        )

        // The user now tries to shrink the node back down via the resize
        // handle, dragging well past the original (pre-growth) height.
        const handle = node.getResizeHandle('SE')
        await handle.hover()
        const box = await handle.boundingBox()
        if (!box) throw new Error('SE resize handle has no bounding box')
        const page = comfyPage.page
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(
          box.x + box.width / 2,
          box.y + box.height / 2 - (grownHeight - baseline.height + 60),
          { steps: 10 }
        )
        await page.mouse.up()
        await comfyPage.nextFrame()

        // Visual proof first: capture the post-drag state regardless of the
        // numeric outcome below, so the screenshot exists even though the
        // next assertion is the one that throws.
        await expect(node.root).toHaveScreenshot(
          'flux-node-stuck-after-shrink-attempt.png'
        )

        // Bug: the rendered height stays pinned at (or above) the grown
        // content floor instead of honoring the user's explicit shrink.
        await expect.poll(getHeight).toBeLessThan(grownHeight - 20)
      }
    )

    test.fail(
      'a tab-visibility cycle spreads the shrink ratchet to an untouched node (PM-1312)',
      async ({ comfyPage }) => {
        const fluxA = await comfyPage.nodeOps.addNode(
          'Flux2ImageNode',
          undefined,
          { x: 500, y: 100 }
        )
        const fluxB = await comfyPage.nodeOps.addNode(
          'Flux2ImageNode',
          undefined,
          { x: 500, y: 700 }
        )
        const loadImageA = await comfyPage.nodeOps.addNode(
          'LoadImage',
          undefined,
          { x: 50, y: 100 }
        )
        await comfyPage.nextFrame()
        await selectFluxModel(comfyPage, fluxA.id)
        await selectFluxModel(comfyPage, fluxB.id)
        await comfyPage.nextFrame()
        await fitToViewInstant(comfyPage)
        await comfyPage.nextFrame()

        const nodeA = new VueNodeFixture(
          comfyPage.vueNodes.getNodeLocator(String(fluxA.id))
        )
        const nodeB = new VueNodeFixture(
          comfyPage.vueNodes.getNodeLocator(String(fluxB.id))
        )
        await expect(nodeA.root).toBeVisible()
        await expect(nodeB.root).toBeVisible()

        const getHeightA = async () => (await nodeA.boundingBox())?.height ?? -1
        const getHeightB = async () => (await nodeB.boundingBox())?.height ?? -1
        const baselineB = await getHeightB()

        // Sanity check: before anything touches node B, it can be shrunk
        // by a small amount like any ordinary node.
        const shrinkBBy = async (deltaY: number) => {
          const handle = nodeB.getResizeHandle('SE')
          await handle.hover()
          const box = await handle.boundingBox()
          if (!box) throw new Error('SE resize handle has no bounding box')
          const page = comfyPage.page
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await page.mouse.down()
          await page.mouse.move(
            box.x + box.width / 2,
            box.y + box.height / 2 + deltaY,
            { steps: 10 }
          )
          await page.mouse.up()
          await comfyPage.nextFrame()
        }
        await shrinkBBy(-20)
        await expect.poll(getHeightB).toBeLessThan(baselineB)
        // Restore B so the real test below starts from a known baseline.
        await shrinkBBy(20)
        await expect.poll(getHeightB).toBeGreaterThan(baselineB - 5)

        // Only node A is touched: connecting a reference image grows its
        // content beyond its current explicit size.
        await connectNextReferenceImage(comfyPage, fluxA.id, loadImageA.id)
        await comfyPage.nextFrame()
        await expect.poll(getHeightA).toBeGreaterThan(0)

        // Simulate switching browser tabs away and back.
        await comfyPage.page.evaluate(() => {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden'
          })
          document.dispatchEvent(new Event('visibilitychange'))
        })
        await comfyPage.nextFrame()
        await comfyPage.page.evaluate(() => {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible'
          })
          document.dispatchEvent(new Event('visibilitychange'))
        })
        await comfyPage.nextFrame()
        await comfyPage.idleFrames(3)

        const heightBAfterCycle = await getHeightB()

        // Bug: node B, which the user never touched, is now also stuck and
        // cannot be shrunk back down — the tab-visibility cycle spread the
        // "can't shrink" ratchet from node A to every node sharing the
        // measurement singleton.
        await shrinkBBy(-20)
        await expect.poll(getHeightB).toBeLessThan(heightBAfterCycle - 5)
      }
    )
  }
)
