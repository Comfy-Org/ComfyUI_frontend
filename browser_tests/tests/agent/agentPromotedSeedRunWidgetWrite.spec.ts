import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { PromptResponse } from '@/platform/remote/comfyui/types'

import subgraphWorkflow from '@e2e/assets/subgraphs/agent-subgraph-with-two-promoted-widgets.json' with { type: 'json' }
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import type { ToastHelper } from '@e2e/fixtures/helpers/ToastHelper'
import {
  AGENT_SUBGRAPH_HOST_ID,
  AGENT_SUBGRAPH_INITIAL_SEED,
  agentSubgraphNodeDefs
} from '@e2e/fixtures/data/agentSubgraphFollower'
import { loadSeedIntoActiveTab } from '@e2e/fixtures/utils/seedActiveTab'

const WORKFLOW_ID = 'c2003000-0000-4000-8000-000000000001'
const MESSAGE_ID = 'c2003000-0000-4000-8000-000000000002'
const THREAD_ID = 'c2003000-0000-4000-8000-000000000003'

const catalog: WidgetCatalog = {
  types: {
    AgentClipSource: { widget_order: [] },
    CLIPTextEncode: { widget_order: ['text'] },
    KSampler: {
      widget_order: [
        'seed',
        'control_after_generate',
        'steps',
        'cfg',
        'sampler_name',
        'scheduler',
        'denoise'
      ]
    }
  }
}

async function acceptPrompts(page: Page): Promise<unknown[]> {
  const submitted: unknown[] = []
  await page.route(/\/api\/prompt$/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    submitted.push(route.request().postDataJSON())
    const response: PromptResponse = {
      prompt_id: `pm-2003-run-${submitted.length}`,
      number: submitted.length,
      node_errors: {}
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    })
  })
  return submitted
}

function promotedSeed(page: Page): Promise<unknown> {
  return page.evaluate(
    (hostId) =>
      window
        .app!.graph.nodes.find(({ id }) => String(id) === String(hostId))
        ?.widgets?.find(({ name }) => name === 'seed')?.value,
    AGENT_SUBGRAPH_HOST_ID
  )
}

interface AttachedAgent {
  host: HostDoc
  hostSocket: AgentFollowerHostSocket
  submitted: unknown[]
}

async function attachAgent(
  page: Page,
  agentFlagEnabled: boolean
): Promise<AttachedAgent> {
  const host = new HostDoc(WORKFLOW_ID, subgraphWorkflow, catalog)
  const hostSocket = new AgentFollowerHostSocket(
    page,
    WORKFLOW_ID,
    host,
    'apply'
  )
  await hostSocket.install()

  await page.setViewportSize({ width: 1920, height: 1280 })
  await bootAgentApp(page, agentFlagEnabled, {
    settings: { 'Comfy.VueNodes.Enabled': true },
    objectInfo: agentSubgraphNodeDefs,
    beforeNavigate: async (page) => {
      await mockAgentTurnApi(page, {
        message_id: MESSAGE_ID,
        thread_id: THREAD_ID,
        workflow_id: WORKFLOW_ID
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)
    }
  })
  const submitted = await acceptPrompts(page)
  await loadSeedIntoActiveTab(page, subgraphWorkflow)

  await test.step('the agent is attached to the workflow', async () => {
    const agentPanel = new AgentPanel(page)
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.sendMessage('Have a look at this workflow')
    await hostSocket.waitForSubscribe()
    await expect
      .poll(() => promotedSeed(page))
      .toBe(AGENT_SUBGRAPH_INITIAL_SEED)
  })

  return { host, hostSocket, submitted }
}

async function expectRunSavesPromotedSeed(
  page: Page,
  { hostSocket, submitted }: AttachedAgent,
  toast: ToastHelper,
  catchUp: () => void = () => {}
): Promise<void> {
  await test.step('the person presses Run and the promoted seed randomizes', async () => {
    await page
      .getByRole('button', { name: enMessages.menu.run, exact: true })
      .click()
    await expect.poll(() => submitted.length).toBe(1)
    await expect
      .poll(() => promotedSeed(page))
      .not.toBe(AGENT_SUBGRAPH_INITIAL_SEED)
  })

  await test.step('no rejected-edit notice is shown', async () => {
    const rejectionToast = toast.toastErrors.filter({
      hasText: enMessages.agent.editRejected.widgetWrite
    })
    const quietWindowStartedAt = Date.now()
    await expect(async () => {
      await expect(rejectionToast).toHaveCount(0, { timeout: 0 })
      expect(Date.now() - quietWindowStartedAt).toBeGreaterThanOrEqual(2_000)
    }).toPass({ timeout: 4_000, intervals: [100, 250, 500] })
  })

  await test.step('the follower catches up', catchUp)

  await test.step('the randomized seed reaches the shared document', async () => {
    await expect
      .poll(() => hostSocket.humanOpOutcomes())
      .toContainEqual(expect.objectContaining({ outcome: 'applied' }))
  })
}

test.describe(
  'PM-2003 repro: pressing Run on a subgraph host with a promoted randomized seed',
  { tag: ['@cloud', '@agent', '@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 90_000 })

    test('saves the new seed while the shared document is caught up', async ({
      page,
      agentFlagEnabled,
      toast
    }) => {
      const rig = await attachAgent(page, agentFlagEnabled)
      await expectRunSavesPromotedSeed(page, rig, toast)
    })

    test('saves the new seed while the agent connection is re-subscribing', async ({
      page,
      agentFlagEnabled,
      toast
    }) => {
      const rig = await attachAgent(page, agentFlagEnabled)

      let withheldStateVector: string | null = null

      await test.step('the agent connection drops and its re-subscribe is not answered yet', async () => {
        rig.hostSocket.answerSubscribesWith((stateVector) => {
          withheldStateVector = stateVector
          return []
        })
        await rig.hostSocket.disconnect()
        await expect
          .poll(() => withheldStateVector, { timeout: 15_000 })
          .not.toBeNull()
      })

      test.fail(
        true,
        'PM-2003: a promoted write made between a resubscribe and its ack is refused with the widget-write toast (docOpMinter doc_not_synced) instead of being deferred'
      )

      await expectRunSavesPromotedSeed(page, rig, toast, () => {
        if (withheldStateVector === null)
          throw new Error('no re-subscribe was withheld')
        rig.hostSocket.send(rig.host.subscribed())
        rig.hostSocket.send(rig.host.catchUp(withheldStateVector))
      })
    })
  }
)
