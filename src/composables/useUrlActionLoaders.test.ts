import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMemoryHistory, createRouter, useRouter } from 'vue-router'
import {
  capturePreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'

import { useUrlActionLoaders } from './useUrlActionLoaders'
import type { useWorkflowLinkUrlLoader } from '@/platform/workflow/management/composables/useWorkflowLinkUrlLoader'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const workflowLinkUrlLoader = vi.hoisted(() => ({
  openWorkflowLinkFromUrl: vi.fn<
    ReturnType<typeof useWorkflowLinkUrlLoader>['openWorkflowLinkFromUrl']
  >(async () => 'absent'),
  isLinkSettled: vi.fn<
    ReturnType<typeof useWorkflowLinkUrlLoader>['isLinkSettled']
  >(() => false),
  hasLinkInFlight: vi.fn<
    ReturnType<typeof useWorkflowLinkUrlLoader>['hasLinkInFlight']
  >(() => false)
}))
vi.mock(
  import('@/platform/workflow/management/composables/useWorkflowLinkUrlLoader'),
  () => ({ useWorkflowLinkUrlLoader: () => workflowLinkUrlLoader })
)

const mocks = vi.hoisted(() => ({
  reportError: vi.fn(),
  loadDeployment: vi.fn(async (): Promise<boolean> => false),
  loadWorkspace: vi.fn(async (): Promise<boolean | undefined> => undefined),
  loadInvite: vi.fn(async () => undefined),
  loadCreateWorkspace: vi.fn(async () => undefined),
  loadPricingTable: vi.fn(async () => undefined),
  loadTopUp: vi.fn(async () => undefined),
  loadSettings: vi.fn(),
  loadAssets: vi.fn(async () => undefined),
  loadLocalHandoff: vi.fn(async () => undefined),
  useDeployment: vi.fn(),
  useWorkspace: vi.fn(),
  useInvite: vi.fn(),
  useCreateWorkspace: vi.fn(),
  usePricingTable: vi.fn(),
  useTopUp: vi.fn(),
  useSettings: vi.fn(),
  useAssets: vi.fn(),
  useLocalHandoff: vi.fn()
}))
mocks.useDeployment.mockImplementation(() => ({
  loadDeploymentFromUrl: mocks.loadDeployment
}))
mocks.useWorkspace.mockImplementation(() => ({
  loadWorkspaceFromUrl: mocks.loadWorkspace
}))
mocks.useInvite.mockImplementation(() => ({
  loadInviteFromUrl: mocks.loadInvite
}))
mocks.useCreateWorkspace.mockImplementation(() => ({
  loadCreateWorkspaceFromUrl: mocks.loadCreateWorkspace
}))
mocks.usePricingTable.mockImplementation(() => ({
  loadPricingTableFromUrl: mocks.loadPricingTable
}))
mocks.useTopUp.mockImplementation(() => ({
  loadTopUpFromUrl: mocks.loadTopUp
}))
mocks.useSettings.mockImplementation(() => ({
  loadSettingsFromUrl: mocks.loadSettings
}))
mocks.useAssets.mockImplementation(() => ({
  loadAssetsFromUrl: mocks.loadAssets
}))
mocks.useLocalHandoff.mockImplementation(() => ({
  loadLocalHandoffFromUrl: mocks.loadLocalHandoff
}))

// A real router rather than a stub: several assertions are the URL a reader
// is left looking at, and only the real thing resolves and merges a query
// the way the app does.
vi.mock(import('vue-router'), { spy: true })

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
})

vi.mock(
  import('@/platform/workspace/composables/useDeploymentUrlLoader'),
  () => ({
    useDeploymentUrlLoader: mocks.useDeployment
  })
)
vi.mock(
  import('@/platform/workspace/composables/useWorkspaceUrlLoader'),
  () => ({
    useWorkspaceUrlLoader: mocks.useWorkspace
  })
)
vi.mock(import('@/platform/account/composables/useInviteUrlLoader'), () => ({
  useInviteUrlLoader: mocks.useInvite
}))
vi.mock(
  import('@/platform/account/composables/useCreateWorkspaceUrlLoader'),
  () => ({
    useCreateWorkspaceUrlLoader: mocks.useCreateWorkspace
  })
)
vi.mock(
  import('@/platform/billing/subscription/composables/usePricingTableUrlLoader'),
  () => ({ usePricingTableUrlLoader: mocks.usePricingTable })
)
vi.mock(
  import('@/platform/billing/subscription/composables/useTopUpUrlLoader'),
  () => ({
    useTopUpUrlLoader: mocks.useTopUp
  })
)
vi.mock(import('@/platform/settings/composables/useSettingsUrlLoader'), () => ({
  useSettingsUrlLoader: mocks.useSettings
}))
vi.mock(import('@/platform/assets/composables/useAssetsUrlLoader'), () => ({
  useAssetsUrlLoader: mocks.useAssets
}))
vi.mock(
  import('@/platform/openOnCloud/composables/useLocalHandoffUrlLoader'),
  () => ({ useLocalHandoffUrlLoader: mocks.useLocalHandoff })
)
vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))

describe('useUrlActionLoaders', () => {
  beforeEach(async () => {
    mockIsCloud.value = true
    mocks.useDeployment.mockImplementation(() => ({
      loadDeploymentFromUrl: mocks.loadDeployment
    }))
    mocks.useWorkspace.mockImplementation(() => ({
      loadWorkspaceFromUrl: mocks.loadWorkspace
    }))
    mocks.useInvite.mockImplementation(() => ({
      loadInviteFromUrl: mocks.loadInvite
    }))
    mocks.useCreateWorkspace.mockImplementation(() => ({
      loadCreateWorkspaceFromUrl: mocks.loadCreateWorkspace
    }))
    mocks.usePricingTable.mockImplementation(() => ({
      loadPricingTableFromUrl: mocks.loadPricingTable
    }))
    mocks.useTopUp.mockImplementation(() => ({
      loadTopUpFromUrl: mocks.loadTopUp
    }))
    mocks.useSettings.mockImplementation(() => ({
      loadSettingsFromUrl: mocks.loadSettings
    }))
    mocks.useAssets.mockImplementation(() => ({
      loadAssetsFromUrl: mocks.loadAssets
    }))
    mocks.useLocalHandoff.mockImplementation(() => ({
      loadLocalHandoffFromUrl: mocks.loadLocalHandoff
    }))
    vi.mocked(useRouter).mockReturnValue(router)
    await router.replace({ path: '/', query: {} })
  })

  // Most loaders fire their cleanup replace without waiting for it, so with two
  // deep links in one URL the later navigation cancels the earlier one and its
  // param survives. The sweep at the end is what the reader actually sees.
  it('clears a param an earlier loader raced away, leaving the rest alone', async () => {
    await router.replace({
      path: '/',
      query: { topup: '1', assets: '1', workflow: 'keep-me' }
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({ workflow: 'keep-me' })
  })

  it('does not hand back the Stripe params the router still thinks are there', async () => {
    await router.replace({
      path: '/',
      query: {
        assets: '1',
        payment_intent: 'pi_123',
        payment_intent_client_secret: 'pi_123_secret_456',
        redirect_status: 'succeeded'
      }
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({})
  })

  // The workspace loader's own strip catches a rejected router.replace and
  // returns normally, so a failed strip must not leave ?workspace= stranded
  // with no retry — the sweep is the backstop.
  it('clears a workspace param the loader itself failed to strip', async () => {
    await router.replace({
      path: '/',
      query: { workspace: 'w-1', workflow: 'keep-me' }
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({ workflow: 'keep-me' })
  })

  it('keeps a query that carries no deep-link param', async () => {
    await router.replace({ path: '/', query: { workflow: 'keep-me' } })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({ workflow: 'keep-me' })
  })

  it('does not instantiate or run any loader off cloud', async () => {
    mockIsCloud.value = false

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.useDeployment).not.toHaveBeenCalled()
    expect(mocks.useWorkspace).not.toHaveBeenCalled()
    expect(mocks.useInvite).not.toHaveBeenCalled()
    expect(mocks.useCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.usePricingTable).not.toHaveBeenCalled()
    expect(mocks.useTopUp).not.toHaveBeenCalled()
    expect(mocks.useSettings).not.toHaveBeenCalled()
    expect(mocks.useAssets).not.toHaveBeenCalled()
    expect(mocks.useLocalHandoff).not.toHaveBeenCalled()
    expect(useSubscriptionDialog).not.toHaveBeenCalled()
    expect(mocks.loadDeployment).not.toHaveBeenCalled()
    expect(mocks.loadWorkspace).not.toHaveBeenCalled()
    expect(mocks.loadInvite).not.toHaveBeenCalled()
    expect(mocks.loadCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.loadPricingTable).not.toHaveBeenCalled()
    expect(mocks.loadTopUp).not.toHaveBeenCalled()
    expect(mocks.loadSettings).not.toHaveBeenCalled()
    expect(mocks.loadAssets).not.toHaveBeenCalled()
    expect(mocks.loadLocalHandoff).not.toHaveBeenCalled()
    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).not.toHaveBeenCalled()
  })

  it('runs all loaders on Cloud', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadDeployment).toHaveBeenCalledOnce()
    expect(mocks.loadWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadPricingTable).toHaveBeenCalledOnce()
    expect(mocks.loadTopUp).toHaveBeenCalledOnce()
    expect(mocks.loadSettings).toHaveBeenCalledOnce()
    expect(mocks.loadAssets).toHaveBeenCalledOnce()
    expect(mocks.loadLocalHandoff).toHaveBeenCalledOnce()
  })

  it('opens the requested workspace before any other loader reads the URL', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadInvite.mock.invocationCallOrder[0]
    )
    expect(mocks.loadWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadSettings.mock.invocationCallOrder[0]
    )
    expect(mocks.loadWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadPricingTable.mock.invocationCallOrder[0]
    )
    expect(mocks.loadWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadAssets.mock.invocationCallOrder[0]
    )
  })

  // With ?deployment the deployment link owns ?workspace too: the workspace
  // loader alone would strip ?workspace and switch, and the boot after that
  // reload would find a link with no workspace in it.
  it('reads a deployment link before the workspace link', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadDeployment.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadWorkspace.mock.invocationCallOrder[0]
    )
  })

  // The deployment link keeps both params across its own workspace switch,
  // so the boot after the reload can pick; nothing may strip them first.
  it('stops before every other step, the sweep included, when the deployment link reloads', async () => {
    await router.replace({
      path: '/',
      query: { workspace: 'w-2', deployment: 'dep-1', workflows: 'build' }
    })
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.WORKFLOWS,
      { workflows: 'build' },
      ['workflows']
    )
    mocks.loadDeployment.mockResolvedValueOnce(true)

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadWorkspace).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query).toEqual({
      workspace: 'w-2',
      deployment: 'dep-1',
      workflows: 'build'
    })
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOWS, 'workflows')
    ).toBe('build')
  })

  it('clears a workflows folder a deployment link left when it did not reload', async () => {
    await router.replace({
      path: '/',
      query: { deployment: 'dep-1', workflows: 'build', workflow: 'keep-me' }
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({ workflow: 'keep-me' })
  })

  it('clears a workflows folder stash a deployment link left when it did not reload', async () => {
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.WORKFLOWS,
      { workflows: 'build' },
      ['workflows']
    )

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOWS, 'workflows')
    ).toBeUndefined()
  })

  it.for(['deployment', 'workspace'] as const)(
    'preserves the workflow-id link across a %s reload without opening it',
    async (kind) => {
      await router.replace({
        query: { workflowId: 'workflow-id', workflows: 'ignored' }
      })
      capturePreservedQuery(
        PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
        { workflowId: 'workflow-id' },
        ['workflowId']
      )
      const loader =
        kind === 'deployment' ? mocks.loadDeployment : mocks.loadWorkspace
      loader.mockResolvedValueOnce(true)

      await useUrlActionLoaders().runUrlActionLoaders()

      expect(
        workflowLinkUrlLoader.openWorkflowLinkFromUrl
      ).not.toHaveBeenCalled()
      expect(router.currentRoute.value.query.workflowId).toBe('workflow-id')
      expect(
        getPreservedQueryParam(
          PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
          'workflowId'
        )
      ).toBe('workflow-id')
    }
  )

  it('finishes the workflow-id link after navigation and clears the URL and stash', async () => {
    await router.replace({ query: { workflowId: 'workflow-id', keep: 'yes' } })
    workflowLinkUrlLoader.isLinkSettled.mockReturnValue(true)
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
      { workflowId: 'workflow-id' },
      ['workflowId']
    )

    await useUrlActionLoaders().runUrlActionLoaders()

    expect(
      workflowLinkUrlLoader.openWorkflowLinkFromUrl
    ).toHaveBeenCalledExactlyOnceWith(true)
    expect(
      workflowLinkUrlLoader.openWorkflowLinkFromUrl.mock.invocationCallOrder[0]
    ).toBeGreaterThan(mocks.loadWorkspace.mock.invocationCallOrder[0])
    expect(router.currentRoute.value.query).toEqual({ keep: 'yes' })
    expect(
      getPreservedQueryParam(
        PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
        'workflowId'
      )
    ).toBeUndefined()
  })

  it('leaves a workflow-id link the browser navigated to after the settled one', async () => {
    await router.replace({ query: { workflowId: 'workflow-a', keep: 'yes' } })
    workflowLinkUrlLoader.isLinkSettled.mockImplementation(
      (workflowId) => workflowId === 'workflow-a'
    )
    workflowLinkUrlLoader.openWorkflowLinkFromUrl.mockImplementation(
      async () => {
        await router.replace({
          query: { workflowId: 'workflow-b', keep: 'yes' }
        })
        capturePreservedQuery(
          PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
          { workflowId: 'workflow-b' },
          ['workflowId']
        )
        return 'opened'
      }
    )

    await useUrlActionLoaders().runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({
      workflowId: 'workflow-b',
      keep: 'yes'
    })
    expect(
      getPreservedQueryParam(
        PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
        'workflowId'
      )
    ).toBe('workflow-b')
  })

  it('runs the later loaders and clears their params while a workflow-id link is pending', async () => {
    await router.replace({
      query: { workflowId: 'workflow-id', invite: 'inv-1', settings: 'x' }
    })
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
      { workflowId: 'workflow-id' },
      ['workflowId']
    )
    workflowLinkUrlLoader.openWorkflowLinkFromUrl.mockResolvedValue('pending')

    await useUrlActionLoaders().runUrlActionLoaders()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadSettings).toHaveBeenCalledOnce()
    expect(mocks.loadLocalHandoff).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.query).toEqual({
      workflowId: 'workflow-id'
    })
    expect(
      getPreservedQueryParam(
        PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
        'workflowId'
      )
    ).toBe('workflow-id')
    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
  })

  it('clears the other params but leaves a newer workflow-id link and its stash', async () => {
    await router.replace({ query: { workflowId: 'workflow-a', topup: '1' } })
    workflowLinkUrlLoader.isLinkSettled.mockImplementation(
      (workflowId) => workflowId === 'workflow-a'
    )
    workflowLinkUrlLoader.openWorkflowLinkFromUrl.mockImplementation(
      async () => {
        await router.replace({
          query: { workflowId: 'workflow-b', topup: '1' }
        })
        capturePreservedQuery(
          PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
          { workflowId: 'workflow-b' },
          ['workflowId']
        )
        return 'opened'
      }
    )

    await useUrlActionLoaders().runUrlActionLoaders()

    expect(mocks.loadTopUp).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.query).toEqual({
      workflowId: 'workflow-b'
    })
    expect(
      getPreservedQueryParam(
        PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
        'workflowId'
      )
    ).toBe('workflow-b')
    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
  })

  it('skips the later loaders and lets a newer workflow-id link held in a navigation guard land', async () => {
    await router.replace({ query: { workflowId: 'workflow-a', topup: '1' } })
    workflowLinkUrlLoader.openWorkflowLinkFromUrl.mockResolvedValue('opened')
    workflowLinkUrlLoader.isLinkSettled.mockImplementation(
      (workflowId) => workflowId === 'workflow-a'
    )
    workflowLinkUrlLoader.hasLinkInFlight.mockReturnValue(true)
    let releaseGuard: () => void = () => {}
    const removeGuard = router.beforeEach(() => {
      removeGuard()
      return new Promise<void>((resolve) => {
        releaseGuard = resolve
      })
    })
    const newerLink = router.push({ query: { workflowId: 'workflow-b' } })

    await useUrlActionLoaders().runUrlActionLoaders()
    releaseGuard()
    await newerLink

    expect(mocks.loadTopUp).not.toHaveBeenCalled()
    expect(mocks.loadSettings).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query).toEqual({
      workflowId: 'workflow-b'
    })
    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
  })

  it('retains a deferred workflow-id URL and stash after identity changes', async () => {
    await router.replace({
      query: { workflowId: 'workflow-id', workflows: 'ignored' }
    })
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
      { workflowId: 'workflow-id' },
      ['workflowId']
    )
    workflowLinkUrlLoader.openWorkflowLinkFromUrl.mockResolvedValue('pending')

    await useUrlActionLoaders().runUrlActionLoaders()

    expect(router.currentRoute.value.query.workflowId).toBe('workflow-id')
    expect(
      getPreservedQueryParam(
        PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
        'workflowId'
      )
    ).toBe('workflow-id')
  })

  it('clears a deployment param no loader acted on', async () => {
    await router.replace({
      path: '/',
      query: { deployment: 'dep-1', workflow: 'keep-me' }
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({ workflow: 'keep-me' })
  })

  it('isolates a workspace-loader failure so it does not abort the boot chain', async () => {
    mocks.loadWorkspace.mockRejectedValueOnce(new Error('boom'))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadSettings).toHaveBeenCalledOnce()
  })

  it('stops the loop when the workspace loader reports a reload in flight', async () => {
    mocks.loadWorkspace.mockResolvedValueOnce(true)

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadInvite).not.toHaveBeenCalled()
    expect(mocks.loadCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.loadPricingTable).not.toHaveBeenCalled()
    expect(mocks.loadTopUp).not.toHaveBeenCalled()
    expect(mocks.loadSettings).not.toHaveBeenCalled()
    expect(mocks.loadAssets).not.toHaveBeenCalled()
  })

  // A successful switch reloads the page, so the sweep step must never run
  // on this path either — it would otherwise strip whatever the reload
  // needs to re-read once the new page loads.
  it('does not run the param sweep when a switch reload is in flight', async () => {
    await router.replace({ path: '/', query: { workspace: 'w-1' } })
    mocks.loadWorkspace.mockResolvedValueOnce(true)

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({ workspace: 'w-1' })
  })

  it('skips checkout recovery when a switch reload is in flight', async () => {
    mocks.loadWorkspace.mockResolvedValueOnce(true)

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).not.toHaveBeenCalled()
  })

  it('recovers an interrupted checkout after every URL loader has run', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
    expect(
      vi.mocked(useSubscriptionDialog().resumePendingPricingFlow).mock
        .invocationCallOrder[0]
    ).toBeGreaterThan(mocks.loadAssets.mock.invocationCallOrder[0])
  })

  it('resolves without waiting for checkout recovery to settle', async () => {
    vi.mocked(
      useSubscriptionDialog().resumePendingPricingFlow
    ).mockImplementationOnce(() => new Promise<undefined>(() => {}))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
  })

  it('reports a checkout-recovery failure instead of rejecting unhandled', async () => {
    const failure = new Error('boom')
    vi.mocked(
      useSubscriptionDialog().resumePendingPricingFlow
    ).mockRejectedValueOnce(failure)

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadAssets).toHaveBeenCalledOnce()
    await vi.waitFor(() => {
      expect(mocks.reportError).toHaveBeenCalledWith(failure, {
        surface: 'platform',
        errorType: 'billing_pending_checkout_resume_failure'
      })
    })
  })

  it('isolates a pricing-loader failure so it does not abort the boot chain', async () => {
    mocks.loadPricingTable.mockRejectedValueOnce(new Error('boom'))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadTopUp).toHaveBeenCalledOnce()
    expect(mocks.loadAssets).toHaveBeenCalledOnce()
  })

  it('isolates a top-up-loader failure so it does not abort the boot chain', async () => {
    mocks.loadTopUp.mockRejectedValueOnce(new Error('boom'))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadPricingTable).toHaveBeenCalledOnce()
    expect(mocks.loadSettings).toHaveBeenCalledOnce()
    expect(mocks.loadAssets).toHaveBeenCalledOnce()
  })

  it('isolates a settings-loader failure so it does not abort the boot chain', async () => {
    mocks.loadSettings.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadAssets).toHaveBeenCalledOnce()
    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
  })
})
