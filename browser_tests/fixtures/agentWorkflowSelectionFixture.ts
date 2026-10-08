import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { CloudWorkflowEntry } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

type WorkflowSelection = {
  savedPaths: string[]
  postedMessages: string[]
  finishSave: (success: boolean) => void
  pauseWorkflowLookups: () => void
  resumeWorkflowLookups: () => void
  workflowLookups: () => number
}

function moveSavedWorkflow(
  source: string,
  destination: string,
  savedContent: Map<string, string>,
  savedFiles: UserDataFullInfo[],
  workflows: CloudWorkflowEntry[]
): UserDataFullInfo | undefined {
  const content = savedContent.get(source)
  const file = savedFiles.find((item) => item.path === source)
  const workflow = workflows.find(
    (item) => item.name === source.slice('workflows/'.length, -'.json'.length)
  )
  if (content === undefined || !file || !workflow) return

  savedContent.delete(source)
  savedContent.set(destination, content)
  file.path = destination
  file.modified = Date.now()
  workflow.name = destination.slice('workflows/'.length, -'.json'.length)
  return file
}

export const workflowSelectionTest = base.extend<{
  nodeDefinitions: Record<string, ComfyNodeDef> | undefined
  workflowSelection: WorkflowSelection
}>({
  nodeDefinitions: [undefined, { option: true }],
  workflowSelection: async ({ page, nodeDefinitions }, use) => {
    if (nodeDefinitions)
      await page.route('**/api/object_info', (route) =>
        route.fulfill(jsonRoute(nodeDefinitions))
      )
    await bootAgentApp(page, true, {
      objectInfo: nodeDefinitions ? 'server' : undefined
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
    function forgetSavedWorkflow(path: string): void {
      const name = path.slice('workflows/'.length, -'.json'.length)
      savedContent.delete(path)
      const fileIndex = savedFiles.findIndex((file) => file.path === path)
      if (fileIndex !== -1) savedFiles.splice(fileIndex, 1)
      const workflowIndex = workflows.findIndex(
        (workflow) => workflow.name === name
      )
      if (workflowIndex !== -1) workflows.splice(workflowIndex, 1)
    }
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
      if (route.request().method() === 'POST')
        postedMessages.push(route.request().postData() ?? '')
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
    await page.route('**/api/userdata/*/move/*', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      const path = decodeURIComponent(
        new URL(route.request().url()).pathname.split('/userdata/')[1]
      )
      const moveSeparator = '/move/'
      const moveIndex = path.indexOf(moveSeparator)
      const movedFile = moveSavedWorkflow(
        path.slice(0, moveIndex),
        path.slice(moveIndex + moveSeparator.length),
        savedContent,
        savedFiles,
        workflows
      )
      return movedFile
        ? route.fulfill(jsonRoute(movedFile))
        : route.fulfill({ status: 404 })
    })
    await page.route('**/api/userdata/*', (route) => {
      const path = decodeURIComponent(
        new URL(route.request().url()).pathname.split('/userdata/')[1]
      )
      if (
        route.request().method() !== 'DELETE' ||
        !path.startsWith('workflows/')
      )
        return route.fallback()
      forgetSavedWorkflow(path)
      return route.fulfill({ status: 204 })
    })
    await use({
      savedPaths,
      postedMessages,
      finishSave: (success) => finishSave(success),
      pauseWorkflowLookups: () => {
        pendingLookup = new Promise<void>((resolve) => {
          resumeWorkflowLookups = resolve
        })
      },
      resumeWorkflowLookups: () => resumeWorkflowLookups(),
      workflowLookups: () => lookupCount
    })
    finishSave(false)
    resumeWorkflowLookups()
  }
})
