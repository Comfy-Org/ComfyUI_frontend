import type {
  AgentMessage,
  AgentRunMode,
  AgentThreadListResponse,
  ListAssetsResponse
} from '@comfyorg/ingest-types'

import type { UserDataFullInfo } from '@comfyorg/api-client/types'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AgentFullscreen } from '@e2e/fixtures/components/AgentFullscreen'
import { EMPTY_AGENT_THREADS } from '@e2e/fixtures/data/agent/agentFullscreen'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

type AgentFullscreenFixtures = {
  chatRedesignEnabled: boolean
  agentThreads: AgentThreadListResponse
  agentTranscripts: Record<string, AgentMessage[]>
  agentOutputs: ListAssetsResponse | undefined
  agentSavedWorkflows: Record<string, ComfyWorkflowJSON>
  agentFullscreen: AgentFullscreen
}

export const agentFullscreenTest = agentTest.extend<AgentFullscreenFixtures>({
  chatRedesignEnabled: [true, { option: true }],
  agentThreads: [EMPTY_AGENT_THREADS, { option: true }],
  agentTranscripts: [{}, { option: true }],
  agentOutputs: [undefined, { option: true }],
  agentSavedWorkflows: [{}, { option: true }],
  agentFullscreen: async (
    {
      page,
      agentFlagEnabled,
      chatRedesignEnabled,
      agentThreads,
      agentTranscripts,
      agentOutputs,
      agentSavedWorkflows
    },
    use
  ) => {
    const runMode: AgentRunMode = { mode: 'ask_approval', credit_limit: null }
    await page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(agentThreads))
    )
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const threadId = new URL(route.request().url()).pathname.split('/').at(-2)
      return route.fulfill(jsonRoute(agentTranscripts[threadId ?? ''] ?? []))
    })
    const savedFiles: UserDataFullInfo[] = Object.entries(
      agentSavedWorkflows
    ).map(([path, workflow], index) => ({
      path: path.slice('workflows/'.length),
      modified: Date.parse('2026-09-01T00:00:00Z') + index * 60_000,
      size: JSON.stringify(workflow).length
    }))
    await bootAgentApp(page, agentFlagEnabled, {
      features: { 'agent-chat-redesign': chatRedesignEnabled },
      assets: agentOutputs,
      beforeNavigate: async (page) => {
        if (savedFiles.length === 0) return
        await page.route('**/api/userdata?*', (route) => {
          const dir = new URL(route.request().url()).searchParams.get('dir')
          if (dir !== 'workflows') return route.fallback()
          return route.fulfill(jsonRoute(savedFiles))
        })
        await page.route('**/api/userdata/*', (route) => {
          const request = route.request()
          const path = decodeURIComponent(
            new URL(request.url()).pathname.split('/userdata/')[1]
          )
          if (request.method() !== 'GET' || !(path in agentSavedWorkflows))
            return route.fallback()
          return route.fulfill(jsonRoute(agentSavedWorkflows[path]))
        })
      }
    })

    const agentFullscreen = new AgentFullscreen(page)
    await agentFullscreen.panel.open()
    await use(agentFullscreen)
  }
})
