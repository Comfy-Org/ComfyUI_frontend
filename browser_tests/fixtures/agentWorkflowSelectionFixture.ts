import { test as base } from '@playwright/test'

import type { UserDataFullInfo } from '@/schemas/apiSchema'
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
    const savedFiles: UserDataFullInfo[] = []
    const savedContent = new Map<string, string>()
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
      finishSave: (success) => finishSave(success)
    })
    finishSave(false)
  }
})
