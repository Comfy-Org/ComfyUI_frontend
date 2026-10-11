import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { agentConversationTest } from '@e2e/fixtures/agentConversationFixture'
import { ClipboardHelper } from '@e2e/fixtures/helpers/ClipboardHelper'
import { CommandHelper } from '@e2e/fixtures/helpers/CommandHelper'
import { KeyboardHelper } from '@e2e/fixtures/helpers/KeyboardHelper'

const NODE_CLICK_SCREEN_POSITION = { x: 400, y: 400 }

export const AGENT_COPY_PASTE_SCENARIO = {
  conversation: 'agent-rec-three-sequential-adds',
  agentAddedStandInType: 'EmptyLatentImage',
  earlierNode: { id: '9', type: 'SaveImage' }
} as const

type LiveGraphNode = Pick<LGraphNode, 'type'> & { id: string }

export class AgentCopyPasteDriver {
  readonly clipboard: ClipboardHelper
  readonly command: CommandHelper
  readonly composer: Locator
  readonly transcript: Locator

  constructor(
    private readonly page: Page,
    private readonly conversation: AgentConversationHarness
  ) {
    this.clipboard = new ClipboardHelper(
      new KeyboardHelper(page, page.locator('#graph-canvas')),
      page
    )
    this.command = new CommandHelper(page)
    this.composer = conversation.composer
    this.transcript = conversation.panel.getByTestId('markdown-stream')
  }

  async replayTurn(turn: number): Promise<void> {
    await this.conversation.sendPrompt(turn)
    await this.conversation.replayResponse(turn)
    await this.conversation.waitForTurnComplete()
    await expect
      .poll(() => this.graphNodes())
      .toContainEqual(
        expect.objectContaining({
          type: AGENT_COPY_PASTE_SCENARIO.agentAddedStandInType
        })
      )
  }

  graphNodes(): Promise<LiveGraphNode[]> {
    return this.page.evaluate(() =>
      window.app!.graph.nodes.map((node) => ({
        id: String(node.id),
        type: node.type
      }))
    )
  }

  async revealAndSelectNode(nodeId: string): Promise<void> {
    await this.page.evaluate(
      ({ id, at }) => {
        const canvas = window.app!.canvas
        const node = window.app!.graph.nodes.find(
          (node) => String(node.id) === id
        )
        if (!node) throw new Error(`no live node ${id}`)
        const { scale } = canvas.ds
        canvas.ds.offset[0] = at.x / scale - node.pos[0]
        canvas.ds.offset[1] = at.y / scale - node.pos[1]
        canvas.setDirty(true, true)
      },
      { id: nodeId, at: NODE_CLICK_SCREEN_POSITION }
    )
    const node = this.conversation.vueNodes.getNodeLocator(nodeId)
    const header = node.locator('.lg-node-header')
    await expect
      .poll(async () => {
        const box = await header.boundingBox()
        if (!box || box.x < 0) return false
        if (!(await this.conversation.panel.isVisible())) return true
        const panelBox = await this.conversation.panel.boundingBox()
        return panelBox !== null && box.x + box.width < panelBox.x
      })
      .toBe(true)
    await this.conversation.vueNodes.selectNode(nodeId)
    await expect(node).toHaveClass(/outline-node-component-outline/)
  }

  async nodeOfType(type: string): Promise<LiveGraphNode> {
    const matches = (await this.graphNodes()).filter(
      (node) => node.type === type
    )
    if (matches.length !== 1)
      throw new Error(
        `expected exactly one live ${type} node, found ${matches.length}`
      )
    return matches[0]
  }

  async nodesAddedSince(before: LiveGraphNode[]): Promise<LiveGraphNode[]> {
    const known = new Set(before.map((node) => node.id))
    return (await this.graphNodes()).filter((node) => !known.has(node.id))
  }
}

export const agentCopyPasteTest = agentConversationTest.extend<{
  agentCopyPaste: AgentCopyPasteDriver
}>({
  agentCopyPaste: async ({ page, agentConversation }, use) => {
    await use(new AgentCopyPasteDriver(page, agentConversation))
  }
})
