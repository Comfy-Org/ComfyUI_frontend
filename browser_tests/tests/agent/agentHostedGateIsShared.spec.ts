import { expect, mergeTests } from '@playwright/test'

import type { AgentSkillListResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ComfyAgentFeature } from '@/platform/remoteConfig/comfyAgentFeature'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const SKILL_NAME = 'shared-gate'
const SKILLS: AgentSkillListResponse = {
  skills: [
    {
      id: 'shared-gate-skill',
      name: SKILL_NAME,
      description: 'A fixture skill for the shared hosted-agent gate.',
      body: 'Reply briefly; do not run workflows.',
      body_hash: 'b'.repeat(64),
      created_at: '2026-11-05T00:00:00Z',
      updated_at: '2026-11-05T00:00:00Z'
    }
  ]
}

test.describe(
  'The skill picker and the agent panel share one hosted-agent gate',
  {
    tag: ['@cloud', '@agent', '@ui'],
    annotation: {
      type: 'issue',
      description:
        'https://github.com/Comfy-Org/ComfyUI_frontend/pull/22985: the picker and the panel each decided whether ComfyUI hosts an agent, so they could disagree and offer a skill the panel cannot run'
    }
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('offers a skill only while the panel can run it', async ({
      page,
      agentPanel,
      getWebSocket
    }) => {
      await page.route('**/api/agent/skills', (route) =>
        route.fulfill(jsonRoute(SKILLS))
      )
      const ws = await getWebSocket()
      const publishAgent = (agent: ComfyAgentFeature) =>
        ws.send(JSON.stringify({ type: 'agent_status', data: agent }))
      const skillOption = page.getByRole('menuitem', {
        name: SKILL_NAME,
        exact: true
      })

      // The boot mocks seed `agent: { state: 'ready' }`, and the browser
      // fixtures disable PostHog flags, so ComfyUI's agent feature is the only
      // thing that can enable either surface here.
      await test.step('a ready agent opens the panel and offers the skill', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.composer.fill('/')
        await expect(skillOption).toBeVisible()
      })

      await test.step('the same agent failing withdraws both surfaces together', async () => {
        publishAgent({ state: 'failed', reason: 'crashed' })
        await expect(agentPanel.root).toHaveCount(0)
        await expect(skillOption).toHaveCount(0)
        const failed = page.getByRole('button', {
          name: enMessages.agent.entryFailed,
          exact: true
        })
        await expect(failed).toHaveAttribute('aria-disabled', 'true')
      })

      await test.step('the agent returning restores both surfaces together', async () => {
        publishAgent({ state: 'ready', reason: null })
        await expect(agentPanel.openButton).not.toHaveAttribute(
          'aria-disabled',
          'true'
        )
        await agentPanel.open()
        await agentPanel.composer.fill('/')
        await expect(skillOption).toBeVisible()
      })
    })

    test('names an unreadable failure reason rather than rendering it', async ({
      page,
      agentPanel,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      await expect(agentPanel.openButton).toBeVisible()

      // One reader validates the payload for both surfaces, so a reason the
      // server did not send as a string is dropped instead of stringified.
      ws.send(
        JSON.stringify({
          type: 'agent_status',
          data: { state: 'failed', reason: { code: 'not_found' } }
        })
      )

      const failed = page.getByRole('button', {
        name: enMessages.agent.entryFailed,
        exact: true
      })
      await expect(failed).toHaveAttribute(
        'title',
        enMessages.agent.entryFailedReason.replace('{reason}', 'unknown')
      )
    })
  }
)
