import { expect, mergeTests } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
  agentTest,
  BLANK_WORKFLOW,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import {
  STAGE_FRAME_TITLES,
  STAGE_FRAMES_CATALOG,
  STAGE_FRAMES_EXISTING_NODES,
  STAGE_FRAMES_INSERT_OPS,
  STAGE_FRAMES_MESSAGE_ID,
  STAGE_FRAMES_SAVED_NAME,
  STAGE_FRAMES_TEMPLATE,
  STAGE_FRAMES_THREAD_ID,
  STAGE_FRAMES_WORKFLOW_ID
} from '@e2e/fixtures/data/agent/agentStageFrames'
import { subscribeAgentWorkflow } from '@e2e/fixtures/utils/subscribeAgentWorkflow'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)
const canvasTextProbeKey = '__comfyE2eCanvasTextProbe'

test.describe(
  'Agent stage frames carried by insert_workflow (PM-947)',
  {
    tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'],
    annotation: {
      type: 'issue',
      description:
        'https://linear.app/comfyorg/issue/PM-947/fix-agent-doesnt-create-groupsframes-to-label-the-stages-of-a-complex'
    }
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    let host: HostDoc
    let socket: WebSocketRoute

    test.beforeEach(async ({ page, getAgentSocket }) => {
      await page.setViewportSize({ width: 1920, height: 1280 })
      await bootAgentApp(page, true, {
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            message_id: STAGE_FRAMES_MESSAGE_ID,
            thread_id: STAGE_FRAMES_THREAD_ID,
            workflow_id: STAGE_FRAMES_WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, STAGE_FRAMES_WORKFLOW_ID)
        }
      })
      await loadIntoBootWorkflow(page, BLANK_WORKFLOW)

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      socket = await getAgentSocket()
      await subscribeAgentWorkflow({
        agentPanel,
        socket,
        workflowId: STAGE_FRAMES_WORKFLOW_ID,
        prompt: 'Build a describe-then-generate workflow with labelled stages'
      })

      host = new HostDoc(
        STAGE_FRAMES_WORKFLOW_ID,
        { nodes: STAGE_FRAMES_EXISTING_NODES, links: [] },
        STAGE_FRAMES_CATALOG
      )
      for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(STAGE_FRAMES_EXISTING_NODES.length)

      await page.evaluate(
        ({ expectedTexts, key }) => {
          const context = window.app!.canvas.bgcanvas.getContext('2d')
          if (!context) throw new Error('Canvas context unavailable')
          const expected = new Set(expectedTexts)
          const observed: string[] = []
          const original = context.fillText.bind(context)
          Reflect.set(window, key, observed)
          context.fillText = (text, x, y, maxWidth) => {
            if (expected.has(text) && !observed.includes(text))
              observed.push(text)
            if (maxWidth === undefined) return original(text, x, y)
            return original(text, x, y, maxWidth)
          }
        },
        { expectedTexts: STAGE_FRAME_TITLES, key: canvasTextProbeKey }
      )
    })

    test('shows each titled stage frame around its own nodes, clear of the existing graph', async ({
      page
    }) => {
      socket.send(JSON.stringify(host.apply(STAGE_FRAMES_INSERT_OPS)))
      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(
          STAGE_FRAMES_EXISTING_NODES.length +
            STAGE_FRAMES_TEMPLATE.nodes.length
        )

      const readFrames = () =>
        page.evaluate(() => {
          const graph = window.app!.graph
          const text = (node: (typeof graph.nodes)[number]) =>
            String(node.widgets?.[0]?.value ?? '')
          return graph.groups
            .map((group) => {
              group.recomputeInsideNodes()
              return {
                title: group.title,
                members: group.nodes.map(text).sort()
              }
            })
            .sort((a, b) => a.title.localeCompare(b.title))
        })

      await expect.poll(readFrames).toEqual([
        {
          title: 'Stage 1: describe the input image',
          members: ['Describe image', 'Load image']
        },
        {
          title: 'Stage 2: generate from the description',
          members: ['Generate image', 'Prompt from description']
        }
      ])
      await expect
        .poll(() =>
          page.evaluate((key) => {
            const observed: unknown = Reflect.get(window, key)
            if (!Array.isArray(observed)) return []
            return observed
              .filter((text): text is string => typeof text === 'string')
              .sort()
          }, canvasTextProbeKey)
        )
        .toEqual(STAGE_FRAME_TITLES)

      const live = await page.evaluate(() => {
        const graph = window.app!.graph
        const existing = graph.nodes.find(
          (node) => node.widgets?.[0]?.value === 'Existing node'
        )!
        const [ex, ey, ew, eh] = existing.boundingRect
        return {
          geometry: Object.fromEntries(
            graph.groups.map((group) => [group.title, [...group._bounding]])
          ),
          overlapsExisting: graph.groups
            .filter((group) => {
              const [gx, gy, gw, gh] = group._bounding
              return (
                gx < ex + ew && ex < gx + gw && gy < ey + eh && ey < gy + gh
              )
            })
            .map((group) => group.title)
        }
      })
      expect(live.overlapsExisting).toEqual([])

      const savedRequest = page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          decodeURIComponent(new URL(request.url()).pathname).startsWith(
            '/api/userdata/workflows/'
          )
      )
      await new Topbar(page).saveWorkflowAs(STAGE_FRAMES_SAVED_NAME)
      const saved = zComfyWorkflow.parse((await savedRequest).postDataJSON())
      if (!saved.groups) throw new Error('Saved workflow omitted groups')
      const savedGeometry = Object.fromEntries(
        saved.groups.map((group) => [group.title, [...group.bounding]])
      )
      expect(savedGeometry).toEqual(live.geometry)
    })
  }
)
