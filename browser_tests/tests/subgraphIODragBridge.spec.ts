import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

const WORKFLOW = 'subgraphs/test-values-input-subgraph'

/**
 * Tests for the subgraph IO drag bridge — verifying that canvas-drawn
 * SubgraphInput drags produce correct visual feedback on Vue-rendered
 * slots (dimming incompatible, highlighting compatible).
 *
 * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10224
 */
test.describe(
  'Subgraph IO drag bridge visual feedback',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Dragging from SubgraphInput dims incompatible Vue slots', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()
      await comfyPage.vueNodes.enterSubgraph('19')
      await comfyPage.vueNodes.waitForNodes()

      // Before drag: no slots should be dimmed
      const outputSlots = page.locator('.lg-slot--output')
      const dimmedBefore = await outputSlots.evaluateAll((els) =>
        els.some((el) => el.classList.contains('opacity-40'))
      )
      expect(dimmedBefore).toBe(false)

      // Start a drag from the seed SubgraphInput (INT type)
      await page.evaluate(() => {
        const canvas = window.app!.canvas
        const graph = canvas!.graph as {
          inputNode: { slots: Array<{ name: string }> }
        }
        const seedSlot = graph.inputNode.slots.find((s) => s.name === 'seed')

        canvas!.linkConnector['dragNewFromSubgraphInput'](
          canvas!.graph!,
          graph.inputNode as never,
          seedSlot as never
        )
      })
      await comfyPage.nextFrame()

      // During drag: incompatible output slots should be dimmed
      // (seed is INT, so CLIP/LATENT/CONDITIONING outputs won't match)
      const dimmedDuring = await outputSlots.evaluateAll((els) =>
        els.some((el) => el.classList.contains('opacity-40'))
      )
      expect(dimmedDuring).toBe(true)

      // Clean up the drag
      await page.evaluate(() => {
        window.app!.canvas!.linkConnector.reset()
      })
      await comfyPage.nextFrame()

      // After reset: dimming should be cleared
      const dimmedAfter = await outputSlots.evaluateAll((els) =>
        els.some((el) => el.classList.contains('opacity-40'))
      )
      expect(dimmedAfter).toBe(false)
    })

    test('Snap-target class is not applied without pointer hover', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()
      await comfyPage.vueNodes.enterSubgraph('19')
      await comfyPage.vueNodes.waitForNodes()

      // No snap targets initially
      const snapTargets = page.locator('.lg-slot--snap-target')
      await expect(snapTargets).toHaveCount(0)

      // Start drag, simulate pointer move over a compatible input slot,
      // and verify the snap-target class appears.
      const hasSnapTarget = await page.evaluate(async () => {
        const canvas = window.app!.canvas!
        const graph = canvas.graph as {
          inputNode: { slots: Array<{ name: string }> }
        }
        const seedSlot = graph.inputNode.slots.find((s) => s.name === 'seed')

        canvas.linkConnector['dragNewFromSubgraphInput'](
          canvas.graph!,
          graph.inputNode as never,
          seedSlot as never
        )

        // Wait a frame for the bridge to activate
        await new Promise((r) => requestAnimationFrame(r))

        // Check if any snap targets exist (the bridge adds them on pointer move)
        const snapCount = document.querySelectorAll(
          '.lg-slot--snap-target'
        ).length

        canvas.linkConnector.reset()
        return snapCount
      })

      // The snap-target is only applied when the pointer hovers over a
      // compatible slot during drag. Without actual pointer movement,
      // we verify the class doesn't appear spuriously.
      expect(hasSnapTarget).toBe(0)
    })

    test('Drag state resets when the LinkConnector resets', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()
      await comfyPage.vueNodes.enterSubgraph('19')
      await comfyPage.vueNodes.waitForNodes()

      // Start and immediately reset a drag
      const result = await page.evaluate(() => {
        const canvas = window.app!.canvas!
        const graph = canvas.graph as {
          inputNode: { slots: Array<{ name: string }> }
        }
        const seedSlot = graph.inputNode.slots.find((s) => s.name === 'seed')

        let resetFired = false
        canvas.linkConnector.events.addEventListener('reset', () => {
          resetFired = true
        })

        canvas.linkConnector['dragNewFromSubgraphInput'](
          canvas.graph!,
          graph.inputNode as never,
          seedSlot as never
        )

        const wasDragging = canvas.linkConnector.isConnecting
        canvas.linkConnector.reset()
        const isDraggingAfter = canvas.linkConnector.isConnecting

        return { wasDragging, isDraggingAfter, resetFired }
      })

      expect(result.wasDragging).toBe(true)
      expect(result.isDraggingAfter).toBe(false)
      expect(result.resetFired).toBe(true)

      // Verify no dimmed slots remain
      const dimmedSlots = page.locator('.lg-slot.opacity-40')
      await expect(dimmedSlots).toHaveCount(0)
    })
  }
)
