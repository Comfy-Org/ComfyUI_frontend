import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

const test = mergeTests(agentTest, webSocketFixture)
const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const WORKFLOW_A = '10000000-0000-4000-8000-00000000000a'
const WORKFLOW_B = '10000000-0000-4000-8000-00000000000b'

function captureClientFrames(ws: WebSocketRoute): Record<string, unknown>[] {
  const frames: Record<string, unknown>[] = []
  ws.onMessage((message) => {
    try {
      frames.push(JSON.parse(String(message)) as Record<string, unknown>)
    } catch {
      // Binary preview traffic is unrelated to the JSON document protocol.
    }
  })
  return frames
}

test.describe('Slice 15 lifetime adapter', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('isolates five A → B → A races, close, reload, and sign-out', async ({
    comfyPage,
    getWebSocket
  }) => {
    test.setTimeout(60_000)
    const { page } = comfyPage

    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.workflow.setupWorkflowsDirectory({})
    await comfyPage.menu.topbar.saveWorkflow('slice15-a')
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.menu.topbar.saveWorkflow('slice15-b')

    await page.evaluate(
      async ({ workflowA, workflowB }) => {
        const currentUserModule = '/src/composables/auth/useCurrentUser.ts'
        const { useCurrentUser } = await import(
          /* @vite-ignore */ currentUserModule
        )
        const subject = useCurrentUser().resolvedUserInfo.value?.id
        if (!subject) throw new Error('agent E2E user was not authenticated')
        localStorage.setItem(
          'Comfy.Agent.WorkflowTabBindings',
          JSON.stringify({
            [subject]: {
              [workflowA]: 'workflows/slice15-a.json',
              [workflowB]: 'workflows/slice15-b.json'
            }
          })
        )
      },
      { workflowA: WORKFLOW_A, workflowB: WORKFLOW_B }
    )
    await page.reload()
    await comfyPage.featureFlags.setServerFlagsPersistent({
      'agent-in-app-experience': true
    })

    const ws = await getWebSocket()
    const frames = captureClientFrames(ws)
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

    const tabA = comfyPage.menu.topbar.getWorkflowTab('slice15-a')
    const tabB = comfyPage.menu.topbar.getWorkflowTab('slice15-b')
    for (let iteration = 0; iteration < 5; iteration++) {
      await tabA.click()
      await tabB.click()
      await tabA.click()
    }

    await expect
      .poll(() =>
        frames
          .filter((frame) => frame.type === 'doc_subscribe')
          .map((frame) => frame.workflow_id)
          .slice(-15)
      )
      .toEqual(
        Array.from({ length: 5 }, () => [
          WORKFLOW_A,
          WORKFLOW_B,
          WORKFLOW_A
        ]).flat()
      )

    await comfyPage.menu.topbar.closeWorkflowTab('slice15-a')
    await expect
      .poll(() =>
        frames.some(
          (frame) =>
            frame.type === 'doc_unsubscribe' && frame.workflow_id === WORKFLOW_A
        )
      )
      .toBe(true)

    await page.reload()
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem('Comfy.Agent.WorkflowTabBindings')
        )
      )
      .not.toContain(WORKFLOW_A)

    await page.evaluate(async () => {
      const authStoreModule = '/src/stores/authStore.ts'
      const apiKeyStoreModule = '/src/stores/apiKeyAuthStore.ts'
      const [{ useAuthStore }, { useApiKeyAuthStore }] = await Promise.all([
        import(/* @vite-ignore */ authStoreModule),
        import(/* @vite-ignore */ apiKeyStoreModule)
      ])
      useAuthStore().currentUser = null
      useApiKeyAuthStore().currentUser = null
    })
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem('Comfy.Agent.WorkflowTabBindings')
        )
      )
      .not.toContain(WORKFLOW_B)
  })
})
