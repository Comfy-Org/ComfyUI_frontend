import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  MAGENTA,
  countColour
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import { nodeLocalRect } from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a1'

type MxNode = 'mxSlider' | 'mxSlider2D' | 'mxSeed' | 'mxStop' | 'mxReroute'

export const test = comfyPageFixture.extend<{
  mxWorkflow: (type: MxNode) => Promise<NodeId>
}>({
  mxWorkflow: async ({ comfyPage }, use) => {
    await use(async (type) => {
      await comfyPage.workflow.loadWorkflow(`nodes2Acceptance/${type}`)
      return toNodeId('1')
    })
  }
})

export async function paintKnobMagenta(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window.LiteGraph!.NODE_TEXT_COLOR = '#ff00ff'
  })
}

export async function nodeSize(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.graph.getNodeById(nodeId)!
    return [node.size[0], node.size[1]]
  }, id)
}

export async function widgetValues(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate(
    (nodeId) =>
      Object.fromEntries(
        window
          .app!.graph.getNodeById(nodeId)!
          .widgets!.map((widget) => [widget.name, widget.value])
      ),
    id
  )
}

async function titleButtonRect(comfyPage: ComfyPage, id: NodeId) {
  const rect = await comfyPage.page.evaluate((nodeId) => {
    const LiteGraph = window.LiteGraph!
    const node = window.app!.graph.getNodeById(nodeId)!
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT
    const buttonWidth = LiteGraph.NODE_COLLAPSED_WIDTH - titleHeight - 6
    return [
      node.size[0] - buttonWidth - 6,
      2 - titleHeight,
      buttonWidth,
      titleHeight - 4
    ] as const
  }, id)
  return nodeLocalRect(comfyPage, id, rect)
}

export async function clickTitleButton(comfyPage: ComfyPage, id: NodeId) {
  const button = await titleButtonRect(comfyPage, id)
  await comfyPage.page.mouse.click(
    button.x + button.width / 2,
    button.y + button.height / 2
  )
}

export async function titleButtonIconPixels(comfyPage: ComfyPage, id: NodeId) {
  await comfyPage.canvasOps.moveMouseToEmptyArea()
  await comfyPage.page.evaluate((nodeId) => {
    window.app!.graph.getNodeById(nodeId)!.boxcolor = '#ff00ff'
  }, id)
  return countColour(
    comfyPage,
    await titleButtonRect(comfyPage, id),
    MAGENTA,
    30
  )
}
