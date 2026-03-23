import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'

/**
 * Returns the link endpoint Y position for a specific input slot on a node.
 * Compares against the node's header Y to detect header-fallback.
 */
async function getLinkTargetY(
  comfyPage: ComfyPage,
  nodeId: string,
  inputIndex: number
): Promise<{ slotY: number; headerY: number }> {
  return comfyPage.page.evaluate(
    ([id, idx]) => {
      const node = window.app!.canvas.graph!.getNodeById(id)
      if (!node) throw new Error(`Node ${id} not found`)

      const slotPos = node.getConnectionPos(true, idx)
      return {
        slotY: slotPos[1],
        headerY: node.pos[1]
      }
    },
    [nodeId, inputIndex] as const
  )
}

const LINKED_WORKFLOW = 'subgraphs/subgraph-promoted-linked'
const SUBGRAPH_NODE_ID = '2'
// Input index 1 = "seed" slot (index 0 = "positive", non-widget)
const SEED_INPUT_INDEX = 1

test.describe(
  'Subgraph promoted widget link position on mode switch',
  { tag: ['@subgraph', '@canvas', '@screenshot'] },
  () => {
    test.describe('Vue-to-Legacy switch', () => {
      test('Link endpoints render at correct slot position, not header', async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.workflow.loadWorkflow(LINKED_WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        // Switch to legacy
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
        await comfyPage.nextFrame()

        // Link endpoint should NOT be at header position
        await expect
          .poll(async () => {
            const { slotY, headerY } = await getLinkTargetY(
              comfyPage,
              SUBGRAPH_NODE_ID,
              SEED_INPUT_INDEX
            )
            return slotY - headerY
          })
          .toBeGreaterThan(20)

        await expect(comfyPage.canvas).toHaveScreenshot(
          'promoted-link-vue-to-legacy.png'
        )
      })
    })

    test.describe('Legacy-to-Vue switch', () => {
      test('Link endpoints converge to correct slot position after mode switch', async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
        await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)

        // Load subgraph workflow and wait for draft to persist
        await comfyPage.workflow.loadWorkflow(LINKED_WORKFLOW)
        await comfyPage.nextFrame()
        await expect
          .poll(
            () =>
              comfyPage.page.evaluate(() => {
                const keys = Object.keys(localStorage)
                return keys.some((k) =>
                  k.startsWith('Comfy.Workflow.Draft.v2:')
                )
              }),
            { timeout: 3000 }
          )
          .toBe(true)

        // Switch to legacy and reload — app restores draft in legacy mode
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
        await comfyPage.page.reload({ waitUntil: 'networkidle' })
        await comfyPage.page.waitForFunction(
          () => window.app && window.app.extensionManager
        )
        await comfyPage.page.waitForSelector('.p-blockui-mask', {
          state: 'hidden'
        })
        await comfyPage.nextFrame()

        // Switch to Vue
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes()

        // Wait for debounced lifecycle reset (800ms + margin)
        await expect
          .poll(
            async () => {
              const { slotY, headerY } = await getLinkTargetY(
                comfyPage,
                SUBGRAPH_NODE_ID,
                SEED_INPUT_INDEX
              )
              return slotY - headerY
            },
            { timeout: 5000 }
          )
          .toBeGreaterThan(20)

        await expect(comfyPage.canvas).toHaveScreenshot(
          'promoted-link-legacy-to-vue.png'
        )
      })
    })

    test.describe('Draft restore', () => {
      test('Link endpoints are correct when app restores a draft workflow on startup', async ({
        comfyPage
      }) => {
        // 1. Enable Vue mode and workflow persistence
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)

        // 2. Load the subgraph workflow — persistence auto-saves a draft
        await comfyPage.workflow.loadWorkflow(LINKED_WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        // 3. Wait for debounced draft persistence to complete
        await expect
          .poll(
            () =>
              comfyPage.page.evaluate(() => {
                const keys = Object.keys(localStorage)
                return keys.some((k) =>
                  k.startsWith('Comfy.Workflow.Draft.v2:')
                )
              }),
            { timeout: 3000 }
          )
          .toBe(true)

        // 4. Reload — app restores the draft via tryLoadGraph (single configure)
        await comfyPage.page.reload({ waitUntil: 'networkidle' })
        // Wait for app to be ready (same checks as setup() but without navigation)
        await comfyPage.page.waitForFunction(
          () => window.app && window.app.extensionManager
        )
        await comfyPage.page.waitForSelector('.p-blockui-mask', {
          state: 'hidden'
        })
        await comfyPage.nextFrame()

        // 5. Verify the draft was restored with the subgraph workflow
        await expect
          .poll(
            async () => {
              return comfyPage.page.evaluate(() => {
                const graph = window.app!.canvas?.graph
                if (!graph) return null
                const sgNode = graph._nodes.find((n) => n.isSubgraphNode())
                if (!sgNode) return null
                return sgNode.widgets?.length ?? 0
              })
            },
            { timeout: 10000 }
          )
          .toBeGreaterThanOrEqual(2)

        // 6. Verify promoted widget labels are visible in Vue DOM
        await comfyPage.vueNodes.waitForNodes()
        const sgNodeId = await comfyPage.page.evaluate(() => {
          const sgNode = window.app!.canvas!.graph!._nodes.find((n) =>
            n.isSubgraphNode()
          )
          return sgNode ? String(sgNode.id) : null
        })
        expect(sgNodeId).not.toBeNull()

        const vueNode = comfyPage.vueNodes.getNodeLocator(sgNodeId!)
        await expect(vueNode).toBeVisible()
        const nodeBody = vueNode.locator(
          `[data-testid="node-body-${sgNodeId}"]`
        )
        await expect(nodeBody).toContainText('my_seed')

        await expect(comfyPage.canvas).toHaveScreenshot(
          'promoted-link-draft-restore.png'
        )
      })
    })
  }
)
