import { test as base } from '@playwright/test'

import type { CloudWorkflowEntry } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

type WorkflowSelection = {
  savedPaths: string[]
  postedMessages: string[]
  finishSave: (success: boolean) => void
}

export const workflowSelectionTest = base.extend<{
  workflowSelection: WorkflowSelection
}>({
  workflowSelection: async ({ page }, use) => {
    await bootAgentApp(page, true)
    const workflows: CloudWorkflowEntry[] = []
    const savedPaths: string[] = []
    const postedMessages: string[] = []
    let finishSave = (_success: boolean) => {}
    await page.route('**/api/workflows?*', (route) =>
      route.fulfill(
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
    )
    await page.route('**/api/agent/threads**', (route) => {
      if (route.request().method() === 'POST')
        postedMessages.push(route.request().postData() ?? '')
      return route.fulfill(jsonRoute({ threads: [] }))
    })
    await page.route('**/api/userdata/*', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      const path = decodeURIComponent(
        new URL(route.request().url()).pathname.split('/userdata/')[1]
      )
      if (!path.startsWith('workflows/')) return route.fallback()
      savedPaths.push(path)
      const success = await new Promise<boolean>((resolve) => {
        finishSave = resolve
      })
      if (!success)
        return route.fulfill({ status: 500, body: 'Save unavailable' })
      workflows.push({
        id: 'a81718a4-02ae-41e6-ae85-c33b7bb880f6',
        name: path.slice('workflows/'.length, -'.json'.length)
      })
      return route.fulfill(
        jsonRoute({
          path,
          modified: Date.now(),
          size: route.request().postDataBuffer()?.length ?? 1
        })
      )
    })
    await use({
      savedPaths,
      postedMessages,
      finishSave: (success) => finishSave(success)
    })
    finishSave(false)
  }
})
