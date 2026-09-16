import { expect, mergeTests } from '@playwright/test'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'

import type { UserDataFullInfo } from '@/schemas/apiSchema'

import { webSocketFixture } from '@e2e/fixtures/ws'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_SUBGRAPH_EDITED_TEXT,
  AGENT_SUBGRAPH_HOST_ID,
  AGENT_SUBGRAPH_INITIAL_TEXT,
  AGENT_SUBGRAPH_LINK_ID,
  AGENT_SUBGRAPH_WORKFLOW_ID,
  agentSubgraphNodeDefs,
  agentSubgraphUpdates
} from '@e2e/fixtures/data/agentSubgraphFollower'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'Agent subgraph follower',
  {
    tag: ['@cloud', '@agent', '@canvas', '@node', '@widget', '@subgraph']
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('materializes a linked host and applies a promoted widget edit', async ({
      page,
      getWebSocket
    }) => {
      await page.addInitScript(() => {
        localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
      })
      await bootAgentApp(page, true, {
        nodeDefs: agentSubgraphNodeDefs,
        turnAccepted: {
          message_id: '3818ba00-d772-4a3f-98c1-9312725b577d',
          thread_id: 'd4c016c4-3b8c-44cf-97de-1ae27e43e718',
          workflow_id: AGENT_SUBGRAPH_WORKFLOW_ID
        }
      })
      let savedName: string | undefined
      await page.route('**/api/userdata/*', (route) => {
        const request = route.request()
        const path = decodeURIComponent(
          new URL(request.url()).pathname.split('/userdata/')[1]
        )
        if (request.method() !== 'POST' || !path.startsWith('workflows/'))
          return route.fallback()
        savedName = path.slice('workflows/'.length, -'.json'.length)
        const saved: UserDataFullInfo = {
          path,
          modified: Date.now(),
          size: request.postDataBuffer()?.length ?? 0
        }
        return route.fulfill(jsonRoute(saved))
      })
      await page.route('**/api/workflows?*', (route) => {
        const workflows: WorkflowListResponse = {
          data:
            savedName === undefined
              ? []
              : [
                  {
                    id: AGENT_SUBGRAPH_WORKFLOW_ID,
                    name: savedName,
                    created_at: '2026-09-01T00:00:00Z',
                    updated_at: '2026-09-01T00:00:00Z',
                    created_by: 'test-user-e2e',
                    latest_version: 1
                  }
                ],
          pagination: {
            has_more: false,
            limit: 100,
            offset: 0,
            total: savedName === undefined ? 0 : 1
          }
        }
        return route.fulfill(jsonRoute(workflows))
      })

      const socket = await getWebSocket()
      const outboundFrames: string[] = []
      socket.onMessage((message) => outboundFrames.push(String(message)))

      await page.getByRole('button', { name: 'Ask Comfy Agent' }).click()
      const panel = page.locator('#agent-panel-root')
      await panel.getByRole('button', { name: 'Switch workflow' }).click()
      await page
        .getByRole('menuitemradio', { name: 'Unsaved Workflow' })
        .click()
      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
      await composer.fill('Build the subgraph')
      await panel.getByRole('button', { name: 'Send' }).click()

      await expect
        .poll(() =>
          outboundFrames.some(
            (frame) =>
              frame.includes('doc_subscribe') &&
              frame.includes(AGENT_SUBGRAPH_WORKFLOW_ID)
          )
        )
        .toBe(true)

      const updates = agentSubgraphUpdates()
      socket.send(
        JSON.stringify({
          type: 'doc_subscribed',
          data: {
            v: 1,
            workflow_id: AGENT_SUBGRAPH_WORKFLOW_ID,
            ok: true,
            seq: 1
          }
        })
      )
      socket.send(
        JSON.stringify({
          type: 'doc_update',
          data: {
            v: 1,
            workflow_id: AGENT_SUBGRAPH_WORKFLOW_ID,
            seq: 1,
            update_b64: updates.initial,
            actor: 'agent:e2e',
            op_ids: [
              '11111111111111111111111111111111',
              '22222222222222222222222222222222'
            ]
          }
        })
      )

      await expect
        .poll(() =>
          page.evaluate(
            ({ hostId, linkId }) => {
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
                inputs: host?.inputs.map(({ name, link }) => ({ name, link })),
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
            { hostId: AGENT_SUBGRAPH_HOST_ID, linkId: AGENT_SUBGRAPH_LINK_ID }
          )
        )
        .toEqual({
          hostType: '422723e8-4bf6-438c-823f-881ca81acead',
          definitionRegistered: true,
          inputs: [
            { name: 'text', link: null },
            { name: 'clip', link: AGENT_SUBGRAPH_LINK_ID },
            { name: 'model', link: null },
            { name: 'positive', link: null },
            { name: 'negative', link: null },
            { name: 'latent_image', link: null }
          ],
          widgets: [{ name: 'text', value: AGENT_SUBGRAPH_INITIAL_TEXT }],
          link: {
            originId: '20',
            targetId: String(AGENT_SUBGRAPH_HOST_ID)
          },
          sourceLinks: [AGENT_SUBGRAPH_LINK_ID]
        })

      socket.send(
        JSON.stringify({
          type: 'doc_update',
          data: {
            v: 1,
            workflow_id: AGENT_SUBGRAPH_WORKFLOW_ID,
            seq: 2,
            update_b64: updates.followUp,
            actor: 'agent:e2e',
            op_ids: ['44444444444444444444444444444444']
          }
        })
      )

      await expect
        .poll(() =>
          page.evaluate(
            (hostId) =>
              window.app!.graph.nodes.find(
                ({ id }) => String(id) === String(hostId)
              )?.widgets?.[0]?.value,
            AGENT_SUBGRAPH_HOST_ID
          )
        )
        .toBe(AGENT_SUBGRAPH_EDITED_TEXT)
    })
  }
)
