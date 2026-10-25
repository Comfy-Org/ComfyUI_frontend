import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

import defaultWorkflow from '@e2e/assets/default.json' with { type: 'json' }
import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  MESSAGE_DONE_EVENT,
  WORKFLOW_ID,
  agentTest,
  pushAgentEvent,
  sentTurn
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

type WorkflowLink = {
  originId: number
  originSlot: number
  targetId: number
  targetSlot: number
}

function carriesLink(body: AgentPostMessageRequest, linkToFind: WorkflowLink) {
  const links = body.draft?.content?.links
  if (!Array.isArray(links)) return null
  return links.some(
    (link) =>
      Array.isArray(link) &&
      link[1] === linkToFind.originId &&
      link[2] === linkToFind.originSlot &&
      link[3] === linkToFind.targetId &&
      link[4] === linkToFind.targetSlot
  )
}

test.describe(
  'A continuing Agent thread on a selected unsaved tab',
  { tag: ['@cloud', '@agent', '@canvas', '@node'] },
  () => {
    test.use({
      connectWebSocketToServer: false,
      objectInfo: 'server',
      initialSettings: { 'Comfy.LinkRelease.Action': 'no action' }
    })

    test('carries the canvas after the user severs a link', async ({
      acceptedTurns,
      agentPanel,
      comfyPage,
      getAgentSocket,
      postedMessages
    }) => {
      test.setTimeout(45_000)
      const firstPrompt = 'What is connected here?'
      const secondPrompt = 'Is it still connected?'
      const severedLink = {
        originId: 4,
        originSlot: 1,
        targetId: 6,
        targetSlot: 0
      }

      await test.step('another tab owns the workflow id the server remembers', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
      })

      const { targetInput, unboundTab } =
        await test.step('the user selects a linked unsaved tab for a new chat', async () => {
          await comfyPage.workflow.newBlankWorkflow()
          await comfyPage.workflow.loadGraphData(
            zComfyWorkflow.parse(defaultWorkflow)
          )
          const unboundTab = await comfyPage.menu.topbar
            .getActiveTab()
            .locator('.workflow-label')
            .innerText()
          expect(unboundTab).toMatch(/^Unsaved Workflow/)
          await agentPanel.root
            .getByRole('button', { name: enMessages.agent.newChat })
            .click()
          await expect(agentPanel.workflowPicker).toHaveText(unboundTab)
          const targetNode = await comfyPage.nodeOps.getNodeRefById(
            severedLink.targetId
          )
          const targetInput = await targetNode.getInput(severedLink.targetSlot)
          await targetInput.expectLinkCount(1)
          return { targetInput, unboundTab }
        })

      await test.step('the first turn receives the other tab workflow id and leaves this tab unbound', async () => {
        await agentPanel.sendMessage(firstPrompt)
        await expect.poll(() => postedMessages.length).toBe(1)
        const first = sentTurn(postedMessages)
        expect(first.current_tab_unbound).toBe(true)
        expect(first.open_tabs?.map((tab) => tab.workflow_id)).toContain(
          WORKFLOW_ID
        )
        expect(carriesLink(first, severedLink)).toBe(true)
        expect(acceptedTurns).toHaveLength(1)
        expect(acceptedTurns[0].workflow_id).toBe(WORKFLOW_ID)
        const socket = await getAgentSocket()
        pushAgentEvent(socket, MESSAGE_DONE_EVENT)
        await agentPanel.expectTurnSettled()
        await expect(agentPanel.workflowPicker).toHaveText(unboundTab)
      })

      await test.step('the user severs the link on the selected canvas', async () => {
        await comfyPage.canvasOps.disconnectEdge()
        await targetInput.expectLinkCount(0)
        await expect
          .poll(async () => {
            const graph = await comfyPage.nodeOps.getSerializedGraph()
            return (graph.links ?? []).some(
              (link) =>
                link[1] === severedLink.originId &&
                link[2] === severedLink.originSlot &&
                link[3] === severedLink.targetId &&
                link[4] === severedLink.targetSlot
            )
          })
          .toBe(false)
      })

      await test.step('the continuing turn carries the updated canvas without the phantom link', async () => {
        await agentPanel.sendMessage(secondPrompt)
        await expect.poll(() => postedMessages.length).toBe(2)
        const second = sentTurn(postedMessages, 1)
        expect(second.workflow_id).toBeUndefined()
        test.fail(
          second.draft === undefined,
          'PM-1410: a continuing turn on a still-unbound tab drops its updated draft'
        )
        expect(
          carriesLink(second, severedLink),
          'the continuing turn must carry the updated draft without the severed link'
        ).toBe(false)
        expect(
          second.draft?.content?.nodes,
          'the continuing turn must carry the selected tab nodes'
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: severedLink.originId }),
            expect.objectContaining({ id: severedLink.targetId })
          ])
        )
      })
    })
  }
)
