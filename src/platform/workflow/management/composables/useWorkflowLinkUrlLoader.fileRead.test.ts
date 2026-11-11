import { reportError } from '@comfyorg/telemetry/reportError'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { createApp, effectScope } from 'vue'
import type { App, EffectScope } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_DEFINITIONS } from '@/platform/navigation/preservedQueryDefinitions'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { installPreservedQueryTracker } from '@/platform/navigation/preservedQueryTracker'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import '@/scripts/changeTracker'

import { useWorkflowLinkUrlLoader } from './useWorkflowLinkUrlLoader'

vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry'))

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const ID = '82b98188-0c8f-41d2-9b91-617b9152b809'
const PATH = 'workflows/Customer Jane Doe.json'
const MODIFIED_MS = 1_793_000_000_000

describe('a workflow-id link whose file read fails', () => {
  let router: Router
  let app: App
  let scope: EffectScope

  function inApp<T>(composable: () => T): T {
    const result = app.runWithContext(() => scope.run(composable))
    assert.exists(result)
    return result
  }

  beforeEach(async () => {
    distribution.isCloud = true
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-1' })
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
    })
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)
    app = createApp({})
    app.use(router)
    await router.push('/')
    scope = effectScope()
    onTestFinished(() => scope.stop())
  })

  it('reports the failure once, through the workflow service, without the file name', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      Response.json({ path: PATH, size: 12, modified: MODIFIED_MS })
    )
    vi.spyOn(api, 'listUserDataFullInfo').mockResolvedValue([
      { path: PATH.slice('workflows/'.length), size: 12, modified: MODIFIED_MS }
    ])
    vi.spyOn(api, 'getUserData').mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Internal Server Error' })
    )
    vi.mocked(
      inApp(useSubgraphNavigationStore).endWorkflowNavigation
    ).mockImplementation(() => {})
    await router.push({ path: '/', query: { workflowId: ID } })
    const loader = inApp(useWorkflowLinkUrlLoader)

    expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

    expect(api.getUserData).toHaveBeenCalledWith(PATH)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      new Error('Could not open workflow link'),
      {
        surface: 'graph',
        errorType: 'error_opening_workflow_link',
        context: { error_name: 'Error' }
      }
    )
  })
})
