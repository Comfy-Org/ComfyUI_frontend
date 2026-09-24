import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  AGENT_NESTED_SUBGRAPH_ID,
  AGENT_SUBGRAPH_EDITED_SEED,
  AGENT_SUBGRAPH_HOST_ID,
  AGENT_SUBGRAPH_INITIAL_SEED,
  AGENT_SUBGRAPH_INITIAL_TEXT,
  AGENT_SUBGRAPH_LINK_ID,
  AGENT_SUBGRAPH_WORKFLOW_ID,
  agentSubgraphNodeDefs,
  agentSubgraphFrames
} from '@e2e/fixtures/data/agentSubgraphFollower'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'Agent subgraph follower',
  {
    tag: ['@cloud', '@agent', '@canvas', '@node', '@widget', '@subgraph']
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('materializes a linked host with nested definitions and applies a promoted widget edit', async ({
      page,
      getWebSocket
    }) => {
      const socket =
        await test.step('open the agent-enabled workflow', async () => {
          await page.setViewportSize({ width: 1920, height: 1280 })
          await bootAgentApp(page, true, {
            onboardingCompleted: true,
            settings: { 'Comfy.VueNodes.Enabled': true },
            objectInfo: agentSubgraphNodeDefs,
            beforeNavigate: async (page) => {
              await mockAgentTurnApi(page, {
                message_id: '3818ba00-d772-4a3f-98c1-9312725b577d',
                thread_id: 'd4c016c4-3b8c-44cf-97de-1ae27e43e718',
                workflow_id: AGENT_SUBGRAPH_WORKFLOW_ID
              })
              await mockWorkflowPersistence(page, AGENT_SUBGRAPH_WORKFLOW_ID)
            }
          })
          return getWebSocket()
        })

      const outboundFrames: string[] = []
      socket.onMessage((message) => outboundFrames.push(String(message)))

      await test.step('select the workflow and send an agent turn', async () => {
        const agentPanel = new AgentPanel(page)
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        const composer = agentPanel.root.getByRole('textbox', {
          name: /^Describe ideas/
        })
        await composer.fill('Build the subgraph')
        await agentPanel.root.getByRole('button', { name: 'Send' }).click()
      })

      await test.step('subscribe the follower to the workflow document', async () => {
        await expect
          .poll(() => outboundFrames, { timeout: 15_000 })
          .toContainEqual(
            expect.stringMatching(
              new RegExp(
                `doc_subscribe.*${AGENT_SUBGRAPH_WORKFLOW_ID}|${AGENT_SUBGRAPH_WORKFLOW_ID}.*doc_subscribe`
              )
            )
          )
      })

      const frames = agentSubgraphFrames()

      await test.step('materialize the linked host and nested definitions', async () => {
        for (const frame of frames.initial) socket.send(JSON.stringify(frame))

        await expect
          .poll(() =>
            page.evaluate(
              ({ hostId, linkId, nestedId }) => {
                const graph = window.app!.graph
                const host = graph.nodes.find(
                  ({ id }) => String(id) === String(hostId)
                )
                const source = graph.nodes.find(({ id }) => String(id) === '20')
                const link = [...graph.links.values()].find(
                  ({ id }) => Number(id) === linkId
                )
                return {
                  hostType: host?.type,
                  definitionRegistered:
                    typeof host?.type === 'string' &&
                    graph.subgraphs.has(host.type),
                  nestedDefinitionRegistered: graph.subgraphs.has(nestedId),
                  inputs: host?.inputs.map(({ name, link }) => ({
                    name,
                    link
                  })),
                  widgets: host?.widgets?.map(({ name, value }) => ({
                    name,
                    value
                  })),
                  link: link
                    ? {
                        originId: String(link.origin_id),
                        targetId: String(link.target_id)
                      }
                    : null,
                  sourceLinks: source?.outputs[0]?.links
                }
              },
              {
                hostId: AGENT_SUBGRAPH_HOST_ID,
                linkId: AGENT_SUBGRAPH_LINK_ID,
                nestedId: AGENT_NESTED_SUBGRAPH_ID
              }
            )
          )
          .toEqual({
            hostType: '422723e8-4bf6-438c-823f-881ca81acead',
            definitionRegistered: true,
            nestedDefinitionRegistered: true,
            inputs: [
              { name: 'text', link: null },
              { name: 'clip', link: AGENT_SUBGRAPH_LINK_ID },
              { name: 'model', link: null },
              { name: 'positive', link: null },
              { name: 'negative', link: null },
              { name: 'latent_image', link: null },
              { name: 'seed', link: null }
            ],
            widgets: [
              { name: 'text', value: AGENT_SUBGRAPH_INITIAL_TEXT },
              { name: 'seed', value: AGENT_SUBGRAPH_INITIAL_SEED }
            ],
            link: {
              originId: '20',
              targetId: String(AGENT_SUBGRAPH_HOST_ID)
            },
            sourceLinks: [AGENT_SUBGRAPH_LINK_ID]
          })
      })

      await test.step('route the promoted seed edit without changing text', async () => {
        socket.send(JSON.stringify(frames.followUp))

        await expect
          .poll(() =>
            page.evaluate((hostId) => {
              const widgets = window.app!.graph.nodes.find(
                ({ id }) => String(id) === String(hostId)
              )?.widgets
              return widgets?.map(({ name, value }) => ({ name, value }))
            }, AGENT_SUBGRAPH_HOST_ID)
          )
          .toEqual([
            { name: 'text', value: AGENT_SUBGRAPH_INITIAL_TEXT },
            { name: 'seed', value: AGENT_SUBGRAPH_EDITED_SEED }
          ])
        await page
          .getByRole('button', { name: 'Fit View (.)', exact: true })
          .click()
        const node = new VueNodeHelpers(page).getNodeLocator(
          String(AGENT_SUBGRAPH_HOST_ID)
        )
        await expect(node.getByRole('textbox')).toHaveValue(
          AGENT_SUBGRAPH_INITIAL_TEXT
        )
        await expect(
          node.getByLabel('seed', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(String(AGENT_SUBGRAPH_EDITED_SEED))
        await page.screenshot({
          path: test.info().outputPath('subgraph-edited.png')
        })
      })

      await test.step('edit the promoted text without changing the seed', async () => {
        const editedText = 'a painting of a lighthouse'
        const node = new VueNodeHelpers(page).getNodeLocator(
          String(AGENT_SUBGRAPH_HOST_ID)
        )
        const textbox = node.getByRole('textbox')
        await expect(textbox).toBeEditable()
        await textbox.fill(editedText)
        await textbox.blur()

        await expect
          .poll(() =>
            page.evaluate((hostId) => {
              const widgets = window.app!.graph.nodes.find(
                ({ id }) => String(id) === String(hostId)
              )?.widgets
              return widgets?.map(({ name, value }) => ({ name, value }))
            }, AGENT_SUBGRAPH_HOST_ID)
          )
          .toEqual([
            { name: 'text', value: editedText },
            { name: 'seed', value: AGENT_SUBGRAPH_EDITED_SEED }
          ])
        await expect(textbox).toHaveValue(editedText)
        await page.screenshot({
          path: test.info().outputPath('subgraph-text-edited.png')
        })
      })
    })
  }
)
