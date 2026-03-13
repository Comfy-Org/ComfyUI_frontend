import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'
import type { Position } from '../fixtures/types'

type NodeSnapshot = { id: number; width: number; height: number } & Position

async function getAllNodePositions(
  comfyPage: ComfyPage
): Promise<NodeSnapshot[]> {
  return comfyPage.page.evaluate(() =>
    window.app!.graph.nodes.map((n) => ({
      id: n.id as number,
      x: n.pos[0],
      y: n.pos[1],
      width: n.size[0],
      height: n.size[1]
    }))
  )
}

async function setVueMode(comfyPage: ComfyPage, enabled: boolean) {
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', enabled)
  if (enabled) {
    await comfyPage.vueNodes.waitForNodes()
  }
  await comfyPage.nextFrame()
}

test.describe(
  'Renderer toggle stability',
  { tag: ['@node', '@canvas'] },
  () => {
    test('node positions do not drift when toggling between Vue and LiteGraph renderers', async ({
      comfyPage
    }) => {
      const TOGGLE_COUNT = 5

      const initialPositions = await getAllNodePositions(comfyPage)
      expect(initialPositions.length).toBeGreaterThan(0)

      for (let i = 0; i < TOGGLE_COUNT; i++) {
        await setVueMode(comfyPage, true)
        const afterVue = await getAllNodePositions(comfyPage)

        for (const initial of initialPositions) {
          const current = afterVue.find((n) => n.id === initial.id)
          expect(
            current,
            `node ${initial.id} missing after Vue toggle ${i + 1}`
          ).toBeDefined()
          expect(current!.x).toBeCloseTo(initial.x, 1)
          expect(current!.y).toBeCloseTo(initial.y, 1)
          expect(current!.width).toBeCloseTo(initial.width, 1)
          expect(current!.height).toBeCloseTo(initial.height, 1)
        }

        await setVueMode(comfyPage, false)
        const afterLG = await getAllNodePositions(comfyPage)

        for (const initial of initialPositions) {
          const current = afterLG.find((n) => n.id === initial.id)
          expect(
            current,
            `node ${initial.id} missing after LG toggle ${i + 1}`
          ).toBeDefined()
          expect(current!.x).toBeCloseTo(initial.x, 1)
          expect(current!.y).toBeCloseTo(initial.y, 1)
          expect(current!.width).toBeCloseTo(initial.width, 1)
          expect(current!.height).toBeCloseTo(initial.height, 1)
        }
      }
    })
  }
)
