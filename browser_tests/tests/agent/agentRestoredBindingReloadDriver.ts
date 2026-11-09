import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentMessages } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const PANEL_MOUNT_TIMEOUT = 30_000

/**
 * Drives the stored-transcript reload path this spec pins. It lives beside the spec rather than in
 * the shared conversation fixture because it has exactly one caller.
 */
export class RestoredBindingReloadDriver {
  private restoredAssistantText = 'Done.'

  constructor(
    private readonly page: Page,
    private readonly agentConversation: AgentConversationHarness
  ) {}

  /** Serve this thread a stored transcript naming its bound workflow, as the service does once a turn has run. */
  async persistThreadTranscript(assistantText = 'Done.'): Promise<void> {
    this.restoredAssistantText = assistantText
    const { conversation } = this.agentConversation
    const workflowId = conversation.workflow.id
    const { content } = conversation.turns[0].request
    await this.page.route('**/api/agent/threads/*/messages', (route) => {
      const request = route.request()
      if (request.method() !== 'GET') return route.fallback()
      // The thread the panel asks for, so the transcript is stored against whatever id it restored.
      const threadId = /\/threads\/([^/]+)\/messages$/.exec(
        new URL(request.url()).pathname
      )?.[1]
      if (threadId === undefined) return route.fallback()
      const history: AgentMessages = [
        {
          id: 'restored-user-1',
          thread_id: threadId,
          turn_id: 'restored-turn-1',
          seq: 1,
          role: 'user',
          status: 'complete',
          workflow_id: workflowId,
          content: { text: content }
        },
        {
          id: 'restored-assistant-1',
          thread_id: threadId,
          turn_id: 'restored-turn-1',
          seq: 2,
          role: 'assistant',
          status: 'complete',
          workflow_id: workflowId,
          content: { text: assistantText }
        }
      ]
      return route.fulfill(jsonRoute(history))
    })
  }

  /** Reload, then wait for the stored transcript to restore `workflowName` as the target. */
  async reloadIntoRestoredTarget(workflowName: string): Promise<void> {
    const { panel } = this.agentConversation
    await this.page.reload({ waitUntil: 'domcontentloaded' })
    await expect(panel).toBeVisible({ timeout: PANEL_MOUNT_TIMEOUT })
    await expect(
      panel.getByText(this.restoredAssistantText).first()
    ).toBeVisible({ timeout: PANEL_MOUNT_TIMEOUT })
    await expect(
      panel.getByRole('button', { name: enMessages.agent.switchWorkflow })
    ).toHaveText(workflowName, { timeout: PANEL_MOUNT_TIMEOUT })
  }

  /** The widget values `nodeId` carries in the draft of the next posted message. */
  async nextPostedDraftWidgetValues(nodeId: number): Promise<unknown[]> {
    const request = await this.page.waitForRequest(
      (candidate) =>
        candidate.method() === 'POST' &&
        /\/api\/agent\/threads\/[^/]+\/messages$/.test(
          new URL(candidate.url()).pathname
        )
    )
    const parsed = zAgentPostMessageRequest.safeParse(
      JSON.parse(request.postData() ?? '{}')
    )
    expect(
      parsed.success,
      'the posted turn must match the request schema'
    ).toBe(true)
    const body: AgentPostMessageRequest | undefined = parsed.data
    const nodes: unknown = body?.draft?.content?.nodes
    if (!Array.isArray(nodes))
      throw new Error('the posted turn carried a draft with no nodes')
    const node: unknown = nodes.find(
      (candidate: unknown) =>
        typeof candidate === 'object' &&
        candidate !== null &&
        'id' in candidate &&
        candidate.id === nodeId
    )
    const values =
      typeof node === 'object' && node !== null && 'widgets_values' in node
        ? node.widgets_values
        : undefined
    if (!Array.isArray(values))
      throw new Error(`the posted draft gave node ${nodeId} no widget values`)
    return values
  }
}
