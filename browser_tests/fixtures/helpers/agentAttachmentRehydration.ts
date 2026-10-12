import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentPostMessageRequest
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export const BARE_DIGEST = 'a'.repeat(64)
export const PLAIN_FILENAME = 'ComfyUI_00002_.png'

interface DroppedLibraryAsset {
  displayName: string
  ref: string
  kind: MediaKind
}

interface WorkflowSelectionControls {
  savedPaths: string[]
  finishSave: (success: boolean) => void
}

export async function dropLibraryAsset(
  page: Page,
  panel: Locator,
  asset: DroppedLibraryAsset
): Promise<void> {
  const dataTransfer = await page.evaluateHandle(
    ({ mime, displayName, ref, kind }) => {
      const transfer = new DataTransfer()
      transfer.setData(
        mime,
        JSON.stringify({
          filename: displayName,
          display_name: displayName,
          subfolder: '',
          type: 'output',
          attachment_ref: ref,
          media_kind: kind
        })
      )
      return transfer
    },
    { mime: MIME_ASSET_INFO, ...asset }
  )
  await panel.dispatchEvent('drop', {
    dataTransfer
  })
  await dataTransfer.dispose()
}

export function resolvedImageRefs(
  posted: AgentPostMessageRequest
): Record<string, unknown> {
  return {
    text: posted.content,
    attachments: posted.attachments,
    attachment_refs: (posted.attachments ?? []).map((name) => ({
      name,
      id: 'asset-rehydrated',
      kind: 'image'
    }))
  }
}

export async function serveHistory(
  page: Page,
  requests: AgentPostMessageRequest[],
  content: (posted: AgentPostMessageRequest) => Record<string, unknown>
): Promise<void> {
  await page.route('**/api/agent/threads/*/messages', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const posted = requests.at(0)
    if (!posted) return route.fallback()
    const threadId = new URL(route.request().url()).pathname.split('/').at(-2)!
    const turnId = 'e2e-rehydrated-turn'
    const messages: AgentMessage[] = [
      {
        id: 'e2e-rehydrated-user',
        thread_id: threadId,
        turn_id: turnId,
        seq: 1,
        role: 'user',
        status: 'complete',
        content: content(posted)
      },
      {
        id: turnId,
        thread_id: threadId,
        turn_id: turnId,
        seq: 2,
        role: 'assistant',
        status: 'complete',
        content: { text: 'Looks good.' }
      }
    ]
    return route.fulfill(jsonRoute(messages))
  })
}

export async function openAgentPanel(
  page: Page,
  workflowSelection: WorkflowSelectionControls
): Promise<Locator> {
  await page
    .getByRole('button', {
      name: enMessages.sideToolbar.newBlankWorkflow,
      exact: true
    })
    .click()
  const agentPanel = new AgentPanel(page)
  const panel = await agentPanel.open()
  await agentPanel.workflowPicker.click()
  await page
    .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
    .click()
  await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
  workflowSelection.finishSave(true)
  return panel
}

export async function sendTurn(panel: Locator, prompt: string): Promise<void> {
  const agentPanel = new AgentPanel(panel.page())
  await agentPanel.composer.pressSequentially(prompt)
  await agentPanel.sendButton.click()
}

export async function reopenAfterReload(
  panel: Locator,
  page: Page
): Promise<Locator> {
  await panel
    .getByRole('button', { name: enMessages.agent.stop, exact: true })
    .click()
  await page.reload()
  await expect(page.getByTestId('integrated-tab-bar-actions')).toHaveAttribute(
    'data-agent-gate-settled',
    'true',
    { timeout: 30_000 }
  )
  const reopened = page.locator('#agent-panel-root')
  await expect(reopened).toBeVisible({ timeout: 30_000 })
  return reopened
}
