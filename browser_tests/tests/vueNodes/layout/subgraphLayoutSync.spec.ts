import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

const GROWTH: [number, number] = [90, 100]

async function renderedBounds(comfyPage: ComfyPage, nodeId: string) {
  return comfyPage.vueNodes
    .getNodeLocator(nodeId)
    .evaluate((element) => [
      element instanceof HTMLElement ? element.offsetWidth : 0,
      element instanceof HTMLElement ? element.offsetHeight : 0
    ])
}

/**
 * Grows a node the way a legacy custom node would — a direct graph mutation,
 * which is the path under test and has no click or keystroke equivalent — then
 * waits for the rendered node to follow.
 *
 * A node only follows while its component still holds a layout subscription.
 * `clearViewGeometry` drops every subscription on each graph transition, so
 * this has to be re-checked after every one.
 */
async function expectGrowthRenders(
  comfyPage: ComfyPage,
  nodeId: string,
  label: string
) {
  const before = await renderedBounds(comfyPage, nodeId)
  expect(before[0], `${label}: node has a rendered width`).toBeGreaterThan(0)
  expect(before[1], `${label}: node has a rendered height`).toBeGreaterThan(0)

  await comfyPage.page.evaluate(
    ({ id, growWidth, growHeight }) => {
      const node = window.app!.canvas.graph!.getNodeById(id)!
      node.setSize([node.size[0] + growWidth, node.size[1] + growHeight])
    },
    { id: toNodeId(nodeId), growWidth: GROWTH[0], growHeight: GROWTH[1] }
  )

  await expect
    .poll(async () => renderedBounds(comfyPage, nodeId), { message: label })
    .toEqual([before[0] + GROWTH[0], before[1] + GROWTH[1]])
}

test(
  'nodes keep following graph mutations across every graph transition',
  { tag: '@vue-nodes' },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    await comfyPage.vueNodes.waitForNodes()

    const [rootNodeId] = await comfyPage.vueNodes.getNodeIds()
    await expectGrowthRenders(comfyPage, rootNodeId, 'at the root graph')

    await comfyPage.vueNodes.enterSubgraph('2')
    const [interiorNodeId] = await comfyPage.vueNodes.getNodeIds()
    await expectGrowthRenders(comfyPage, interiorNodeId, 'inside the subgraph')

    await comfyPage.subgraph.exitViaBreadcrumb()
    await comfyPage.vueNodes.waitForNodes()
    await expectGrowthRenders(
      comfyPage,
      rootNodeId,
      'back at the root graph after leaving the subgraph'
    )

    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.vueNodes.waitForNodes()
    const [reloadedNodeId] = await comfyPage.vueNodes.getNodeIds()
    await expectGrowthRenders(
      comfyPage,
      reloadedNodeId,
      'after loading a second workflow'
    )
  }
)
