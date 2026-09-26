import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { CloudWorkflowEntry } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { emptyAgentThreadPage } from '@e2e/fixtures/utils/agentThreadPage'

type WorkflowSelection = {
  savedPaths: string[]
  postedMessages: string[]
  finishSave: (success: boolean) => void
  pauseWorkflowLookups: () => void
  resumeWorkflowLookups: () => void
  workflowLookups: () => number
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
    // `**/api/agent/threads**` is three endpoints, not one, and each parses
    // with its own schema. `GET .../messages` gets the array `zAgentMessages`
    // wants; the list endpoint gets a contract-complete page.
    //
    // `POST .../messages` deliberately still gets the list body, and that is a
    // known defect, not an oversight. `zAgentTurnAccepted` rejects it, so
    // every send in this suite is refused and the panel renders
    // "Message failed to send: [ …zod… ]" — measured, not inferred. Five
    // assertions across `agentWorkflowSelection.spec.ts` and
    // `agentNewChatTargetWorkflow.spec.ts` are written against that refusal:
    // they assert the composer still holds the draft after Enter, which only
    // happens on the rejected branch (`recoverFailedSubmission`). Two more
    // depend on the panel staying idle, and an accepted turn disables the
    // workflow picker until the turn ends — which needs a `/ws` this fixture
    // cannot own, because `agentTurnLockFixture` and
    // `agentTurnSurvivesSocketDrop` route `/ws` themselves.
    //
    // So fixing the shape here means giving this fixture turn completion and
    // reworking seven assertions across three specs. Evidence and the exact
    // follow-up: in-app-agent-program `reports/jobs/assert-1.md` §5.
    await page.route('**/api/agent/threads**', (route) => {
      const request = route.request()
      const { pathname } = new URL(request.url())
      const isMessages = /\/api\/agent\/threads\/[^/]+\/messages$/.test(
        pathname
      )
      if (request.method() === 'POST')
        postedMessages.push(request.postData() ?? '')
      else if (isMessages) return route.fulfill(jsonRoute([]))
      return route.fulfill(jsonRoute(emptyAgentThreadPage()))
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
