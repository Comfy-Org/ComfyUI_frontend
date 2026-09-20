import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const LOCATOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d+$/i

test.describe(
  'Agent selection node ids for nested nodes (PM-680)',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ objectInfo: 'server' })

    // `node.id` is only unique inside its containing subgraph, so two selected
    // nodes in different subgraph instances can share one bare id. The chip's
    // key, remove action and dedupe all use `selectedNodeKey` (`locatorId ??
    // id`); the outbound payload has to agree or `selection.node_ids` names
    // something other than what the user visibly selected. Unit coverage
    // ((h2)/(h2b) in useAgentSession.test.ts) pins the mapping, but only a
    // browser run proves the composer actually hands a `locatorId` down for a
    // node selected inside a subgraph.
    test('sends the locator-qualified id for a node selected inside a subgraph', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      await comfyPage.nodeOps.clearGraph()
      const ksampler = await comfyPage.nodeOps.addNode('KSampler', undefined, {
        x: 400,
        y: 300
      })
      await comfyPage.nextFrame()

      const subgraphNode = await ksampler.convertToSubgraph()
      await subgraphNode.navigateIntoSubgraph()
      await comfyPage.nextFrame()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      const panel = agentPanel.root

      await panel
        .getByRole('button', { name: enMessages.agent.addToPrompt })
        .click()
      await comfyPage.page
        .getByRole('menuitem', { name: enMessages.agent.nodes })
        .click()
      await expect(
        comfyPage.page.getByTestId('node-selection-mode-banner')
      ).toBeVisible()

      // Conversion keeps the interior node's local id; `getNodeRefsByTitle`
      // does not resolve inside the entered subgraph, which is why the other
      // subgraph specs address the interior by id.
      const interior = await comfyPage.nodeOps.getNodeRefById('1')
      const [{ x, y }, { width, height }] = await Promise.all([
        interior.getPosition(),
        interior.getSize()
      ])
      await comfyPage.canvasOps.mouseClickAt({
        x: x + width / 2,
        y: y + height / 2
      })
      await expect(
        panel.getByRole('button', {
          name: `Remove KSampler #${interior.id} reference`
        })
      ).toBeVisible()

      await panel.getByRole('textbox').fill('What does this node do?')
      await panel
        .getByRole('button', { name: enMessages.agent.send, exact: true })
        .click()
      await expect.poll(() => postedMessages.length).toBe(1)

      const sent = JSON.parse(postedMessages[0]) as {
        selection?: { node_ids?: string[] }
      }
      const nodeIds = sent.selection?.node_ids ?? []
      expect(nodeIds).toHaveLength(1)
      // The discriminating assertion: sending the bare interior id (what the
      // composer did before this change) yields "1", which matches neither.
      expect(nodeIds[0]).toMatch(LOCATOR_ID)
      expect(nodeIds[0]).not.toBe(String(interior.id))
      expect(nodeIds[0]?.endsWith(`:${interior.id}`)).toBe(true)
    })
  }
)
