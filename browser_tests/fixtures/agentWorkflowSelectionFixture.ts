import { mergeTests } from '@playwright/test'

import { networkIsolationFixture } from '@e2e/fixtures/networkIsolationFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'

import type { UserDataFullInfo } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type {
  AgentTurnAccepted,
  CloudWorkflowEntry
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

type WorkflowSelection = {
  savedPaths: string[]
  postedMessages: string[]
  completeLatestWorkflowMessage: () => Promise<void>
  finishSave: (success: boolean) => void
  failNextWorkflowMessage: () => void
  pauseWorkflowLookups: () => void
  refuseNextWorkflowMessage: () => void
  resumeWorkflowLookups: () => void
  workflowLookups: () => number
}

const base = mergeTests(networkIsolationFixture, webSocketFixture)

export const workflowSelectionTest = base.extend<{
  nodeDefinitions: Record<string, ComfyNodeDef> | undefined
  workflowSelection: WorkflowSelection
}>({
  nodeDefinitions: [undefined, { option: true }],
  workflowSelection: async ({ page, nodeDefinitions, getWebSocket }, use) => {
    await bootAgentApp(page, true, {
      objectInfo: nodeDefinitions
    })
    const workflows: CloudWorkflowEntry[] = []
    const savedFiles: UserDataFullInfo[] = []
    const savedContent = new Map<string, string>()
    const savedPaths: string[] = []
    const postedMessages: string[] = []
    let finishSave = (_success: boolean) => {}
    let pendingLookup: Promise<void> | undefined
    let resumeWorkflowLookups = () => {}
    let lookupCount = 0
    let nextWorkflowMessageResponse: 'accept' | 'fail' | 'refuse' = 'accept'
    await page.route('**/api/workflows?*', async (route) => {
      lookupCount++
      await pendingLookup
      return route.fulfill(
        jsonRoute({
          data: workflows,
          pagination: {
            offset: 0,
            limit: 100,
            total: workflows.length,
            has_more: false
          }
        })
      )
    })
    await page.route('**/api/agent/threads**', (route) => {
      const request = route.request()
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/messages')
      ) {
        postedMessages.push(route.request().postData() ?? '')
        if (nextWorkflowMessageResponse === 'fail') {
          nextWorkflowMessageResponse = 'accept'
          return route.fulfill({
            ...jsonRoute({ error: 'send unavailable' }),
            status: 500
          })
        }
        if (nextWorkflowMessageResponse === 'refuse') {
          nextWorkflowMessageResponse = 'accept'
          const refusedId = route.request().postDataJSON().workflow_id
          const refusedIndex = workflows.findIndex(({ id }) => id === refusedId)
          if (refusedIndex !== -1) workflows.splice(refusedIndex, 1)
          return route.fulfill({
            ...jsonRoute({ error: 'workflow not found or access denied' }),
            status: 403
          })
        }
        const accepted: AgentTurnAccepted = {
          thread_id: '6f4b1e2a-7c3d-4e5f-8a9b-0c1d2e3f4a5b',
          message_id: `0a1b2c3d-4e5f-4a6b-8c7d-${String(postedMessages.length).padStart(12, '0')}`
        }
        return route.fulfill({ ...jsonRoute(accepted), status: 202 })
      }
      return route.fulfill(
        jsonRoute({
          threads: [],
          pagination: { offset: 0, limit: 100, total: 0, has_more: false }
        })
      )
    })
    await page.route('**/api/userdata?*', (route) => {
      const dir = new URL(route.request().url()).searchParams.get('dir')
      if (dir !== 'workflows') return route.fallback()
      return route.fulfill(
        jsonRoute(
          savedFiles.map((file) => ({
            ...file,
            path: file.path.slice('workflows/'.length)
          }))
        )
      )
    })
    await page.route('**/api/userdata/*', async (route) => {
      const path = decodeURIComponent(
        new URL(route.request().url()).pathname.split('/userdata/')[1]
      )
      if (!path.startsWith('workflows/')) return route.fallback()
      if (route.request().method() === 'GET') {
        const content = savedContent.get(path)
        return content === undefined
          ? route.fulfill({ status: 404 })
          : route.fulfill({ contentType: 'application/json', body: content })
      }
      if (route.request().method() !== 'POST') return route.fallback()
      savedPaths.push(path)
      const success = await new Promise<boolean>((resolve) => {
        finishSave = resolve
      })
      if (!success)
        return route.fulfill({ status: 500, body: 'Save unavailable' })
      workflows.push({
        id: `a81718a4-02ae-41e6-ae85-${String(workflows.length + 1).padStart(12, '0')}`,
        name: path.slice('workflows/'.length, -'.json'.length)
      })
      const file: UserDataFullInfo = {
        path,
        modified: Date.now(),
        size: route.request().postDataBuffer()?.length ?? 1
      }
      savedFiles.push(file)
      savedContent.set(path, route.request().postData() ?? '{}')
      return route.fulfill(jsonRoute(file))
    })
    await use({
      savedPaths,
      postedMessages,
      completeLatestWorkflowMessage: async () => {
        if (postedMessages.length === 0)
          throw new Error('no accepted workflow message to complete')
        const socket = await getWebSocket()
        socket.send(
          JSON.stringify({
            type: 'agent_message_done',
            data: {
              thread_id: '6f4b1e2a-7c3d-4e5f-8a9b-0c1d2e3f4a5b',
              message_id: `0a1b2c3d-4e5f-4a6b-8c7d-${String(postedMessages.length).padStart(12, '0')}`
            }
          })
        )
      },
      finishSave: (success) => finishSave(success),
      failNextWorkflowMessage: () => {
        nextWorkflowMessageResponse = 'fail'
      },
      pauseWorkflowLookups: () => {
        pendingLookup = new Promise<void>((resolve) => {
          resumeWorkflowLookups = resolve
        })
      },
      refuseNextWorkflowMessage: () => {
        nextWorkflowMessageResponse = 'refuse'
      },
      resumeWorkflowLookups: () => resumeWorkflowLookups(),
      workflowLookups: () => lookupCount
    })
    finishSave(false)
    resumeWorkflowLookups()
  }
})
