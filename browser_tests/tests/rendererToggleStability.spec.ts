import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'

type NodeSnapshot = { id: number } & Position

async function getAllNodePositions(
  comfyPage: ComfyPage
): Promise<NodeSnapshot[]> {
  return comfyPage.page.evaluate(() =>
    window.app!.graph.nodes.map((n) => ({
      id: n.id as number,
      x: n.pos[0],
      y: n.pos[1]
    }))
  )
}

async function getNodePosition(
  comfyPage: ComfyPage,
  nodeId: number
): Promise<Position | undefined> {
  return comfyPage.page.evaluate((targetNodeId) => {
    const node = window.app!.graph.nodes.find((n) => n.id === targetNodeId)
    if (!node) return

    return {
      x: node.pos[0],
      y: node.pos[1]
    }
  }, nodeId)
}

async function expectNodePositionStable(
  comfyPage: ComfyPage,
  initial: NodeSnapshot,
  mode: string
) {
  await expect
    .poll(
      async () => {
        const current = await getNodePosition(comfyPage, initial.id)
        return current?.x ?? Number.NaN
      },
      { message: `node ${initial.id} x drifted in ${mode} mode` }
    )
    .toBeCloseTo(initial.x, 1)

  await expect
    .poll(
      async () => {
        const current = await getNodePosition(comfyPage, initial.id)
        return current?.y ?? Number.NaN
      },
      { message: `node ${initial.id} y drifted in ${mode} mode` }
    )
    .toBeCloseTo(initial.y, 1)
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
        for (const initial of initialPositions) {
          await expectNodePositionStable(
            comfyPage,
            initial,
            `Vue toggle ${i + 1}`
          )
        }

        await setVueMode(comfyPage, false)
        for (const initial of initialPositions) {
          await expectNodePositionStable(
            comfyPage,
            initial,
            `LiteGraph toggle ${i + 1}`
          )
        }
      }
    })
  }
)
