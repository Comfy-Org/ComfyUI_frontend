import { useRouter } from 'vue-router'
import type { LocationQuery } from 'vue-router'

import { useAssetsUrlLoader } from '@/platform/assets/composables/useAssetsUrlLoader'
import { usePricingTableUrlLoader } from '@/platform/billing/subscription/composables/usePricingTableUrlLoader'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { useTopUpUrlLoader } from '@/platform/billing/subscription/composables/useTopUpUrlLoader'
import {
  BILLING_WEB_RETURN_PARAMS,
  STRIPE_RETURN_PARAMS
} from '@/platform/billing/subscription/utils/paymentReturnUrl'
import { isCloud } from '@/platform/distribution/types'
import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useLocalHandoffUrlLoader } from '@/platform/openOnCloud/composables/useLocalHandoffUrlLoader'
import { LOCAL_HANDOFF_PARAM } from '@/platform/openOnCloud/localHandoffProtocol'
import { useSettingsUrlLoader } from '@/platform/settings/composables/useSettingsUrlLoader'
import { useWorkflowLinkUrlLoader } from '@/platform/workflow/management/composables/useWorkflowLinkUrlLoader'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useCreateWorkspaceUrlLoader } from '@/platform/account/composables/useCreateWorkspaceUrlLoader'
import { useDeploymentUrlLoader } from '@/platform/workspace/composables/useDeploymentUrlLoader'
import { useInviteUrlLoader } from '@/platform/account/composables/useInviteUrlLoader'
import { useWorkspaceUrlLoader } from '@/platform/workspace/composables/useWorkspaceUrlLoader'

interface UrlActionStep {
  /** What the loader does, for the failure log — not shown to the customer. */
  readonly failureMessage: string
  readonly run: () => Promise<boolean | void> | boolean | void
}

type UrlActionLoaders = {
  workflowLinkUrlLoader: ReturnType<typeof useWorkflowLinkUrlLoader> | null
  deploymentUrlLoader: ReturnType<typeof useDeploymentUrlLoader> | null
  workspaceUrlLoader: ReturnType<typeof useWorkspaceUrlLoader> | null
  inviteUrlLoader: ReturnType<typeof useInviteUrlLoader> | null
  createWorkspaceUrlLoader: ReturnType<
    typeof useCreateWorkspaceUrlLoader
  > | null
  pricingTableUrlLoader: ReturnType<typeof usePricingTableUrlLoader> | null
  topUpUrlLoader: ReturnType<typeof useTopUpUrlLoader> | null
  settingsUrlLoader: ReturnType<typeof useSettingsUrlLoader> | null
  assetsUrlLoader: ReturnType<typeof useAssetsUrlLoader> | null
  localHandoffUrlLoader: ReturnType<typeof useLocalHandoffUrlLoader> | null
}

/**
 * Every param a loader below consumes, stripped centrally as a backstop. Most
 * loaders fire their own cleanup replace without waiting for it, so with two
 * deep links in one URL the later navigation can cancel the earlier one and
 * leave its param behind; this sweep removes whatever survived once every
 * loader has had its turn. The Stripe ones are already gone from the address
 * bar by then, but only through `history.replaceState`, which leaves the
 * router's own query holding them — so a replace built from that query would
 * hand them back. `workspace` is included too: its own strip catches a
 * rejected `router.replace` and returns normally, so a failed strip needs
 * this backstop rather than leaving the link live with no retry. A
 * successful switch reloads the page and stops the loop before this step
 * runs, so it never re-strips a live workspace switch. `deployment` likewise:
 * the deployment link keeps both params only across its own switch reload,
 * which also stops the loop first. `workflows` is opened at boot, which keeps
 * it (and its preserved-query stash) beside a deployment link for the boot
 * after the pick's reload; a link that did not reload ends here, stash too.
 */
const HANDLED_PARAMS = [
  'workspace',
  'deployment',
  'workflows',
  'invite',
  'create_workspace',
  'pricing',
  'stop',
  'cycle',
  'topup',
  'settings',
  'assets',
  LOCAL_HANDOFF_PARAM,
  ...STRIPE_RETURN_PARAMS,
  ...BILLING_WEB_RETURN_PARAMS
]

function deploymentLinkSteps(
  loader: UrlActionLoaders['deploymentUrlLoader']
): UrlActionStep[] {
  if (!loader) return []
  return [
    {
      failureMessage: 'Failed to open deployment from URL:',
      run: () => loader.loadDeploymentFromUrl()
    }
  ]
}

function workflowLinkSteps(
  loader: UrlActionLoaders['workflowLinkUrlLoader']
): UrlActionStep[] {
  if (!loader) return []
  return [
    {
      failureMessage: 'Failed to open the linked workflow from URL:',
      run: async () => {
        await loader.openWorkflowLinkFromUrl(true)
      }
    }
  ]
}

function sweptWorkflowLinkParams(
  loader: UrlActionLoaders['workflowLinkUrlLoader'],
  query: LocationQuery
): string[] {
  if (!loader) return []
  const stashed = getPreservedQueryParam(
    PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
    'workflowId'
  )
  if (stashed !== undefined && loader.isLinkSettled(stashed))
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID)
  return 'workflowId' in query && loader.isLinkSettled(query.workflowId)
    ? ['workflowId']
    : []
}

function sweepStep(
  loader: UrlActionLoaders['workflowLinkUrlLoader'],
  router: ReturnType<typeof useRouter>
): UrlActionStep {
  return {
    failureMessage: 'Failed to clear handled deep-link params from the URL:',
    run: async () => {
      if (loader?.hasLinkInFlight()) return
      clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
      const query = { ...router.currentRoute.value.query }
      const params = [
        ...HANDLED_PARAMS.filter((param) => param in query),
        ...sweptWorkflowLinkParams(loader, query)
      ]
      if (params.length === 0) return
      for (const param of params) delete query[param]
      await router.replace({ query })
    }
  }
}

function buildUrlActionSteps(
  loaders: UrlActionLoaders,
  router: ReturnType<typeof useRouter>
): UrlActionStep[] {
  const steps = deploymentLinkSteps(loaders.deploymentUrlLoader)

  if (loaders.workspaceUrlLoader) {
    const loader = loaders.workspaceUrlLoader
    steps.push({
      failureMessage: 'Failed to load workspace from URL:',
      run: () => loader.loadWorkspaceFromUrl()
    })
  }
  steps.push(...workflowLinkSteps(loaders.workflowLinkUrlLoader))
  if (loaders.inviteUrlLoader) {
    const loader = loaders.inviteUrlLoader
    steps.push({
      failureMessage: 'Failed to load invite from URL:',
      run: () => loader.loadInviteFromUrl()
    })
  }
  if (loaders.createWorkspaceUrlLoader) {
    const loader = loaders.createWorkspaceUrlLoader
    steps.push({
      failureMessage: 'Failed to load create workspace from URL:',
      run: () => loader.loadCreateWorkspaceFromUrl()
    })
  }
  if (loaders.pricingTableUrlLoader) {
    const loader = loaders.pricingTableUrlLoader
    steps.push({
      failureMessage: 'Failed to load pricing table from URL:',
      run: () => loader.loadPricingTableFromUrl()
    })
  }
  if (loaders.topUpUrlLoader) {
    const loader = loaders.topUpUrlLoader
    steps.push({
      failureMessage: 'Failed to load top-up dialog from URL:',
      run: () => loader.loadTopUpFromUrl()
    })
  }
  if (loaders.settingsUrlLoader) {
    const loader = loaders.settingsUrlLoader
    steps.push({
      failureMessage: 'Failed to load settings panel from URL:',
      run: () => loader.loadSettingsFromUrl()
    })
  }
  if (loaders.assetsUrlLoader) {
    const loader = loaders.assetsUrlLoader
    steps.push({
      failureMessage: 'Failed to open assets panel from URL:',
      run: () => loader.loadAssetsFromUrl()
    })
  }
  if (loaders.localHandoffUrlLoader) {
    const loader = loaders.localHandoffUrlLoader
    steps.push({
      failureMessage: 'Failed to open the workflow handed over from local:',
      run: () => loader.loadLocalHandoffFromUrl()
    })
  }

  steps.push(sweepStep(loaders.workflowLinkUrlLoader, router))

  return steps
}

async function runUrlActionSteps(steps: UrlActionStep[]): Promise<boolean> {
  for (const step of steps) {
    try {
      if (await step.run()) return true
    } catch (error) {
      console.error(`[UrlActionLoaders] ${step.failureMessage}`, error)
    }
  }
  return false
}

/**
 * Reopens a checkout that was interrupted by a redirect payment. Called from
 * `onMounted`, not during workspace init, so the first-run and Templates
 * overlays are already settled and the recovered dialog is reachable.
 * Deliberately not awaited: the resume only settles once the recovered
 * operation reaches a terminal status, which for an abandoned checkout can
 * take hours, and the boot chain (emit('ready'), the tour, telemetry) must
 * not wait on it.
 */
function schedulePendingCheckoutRecovery(
  subscriptionDialog: ReturnType<typeof useSubscriptionDialog> | null
) {
  if (!subscriptionDialog) return

  void (async () => subscriptionDialog.resumePendingPricingFlow())().catch(
    (error) => {
      reportError(error, {
        surface: 'platform',
        errorType: 'billing_pending_checkout_resume_failure'
      })
    }
  )
}

/** Calls a composable only on the cloud distribution; `null` off it. */
function useIfCloud<T>(create: () => T): T | null {
  return isCloud ? create() : null
}

/** Runs Cloud URL actions after workflow boot and recovers interrupted checkout. */
export function useUrlActionLoaders() {
  const router = useRouter()

  const workflowLinkUrlLoader = useIfCloud(useWorkflowLinkUrlLoader)
  const deploymentUrlLoader = useIfCloud(useDeploymentUrlLoader)
  const workspaceUrlLoader = useIfCloud(useWorkspaceUrlLoader)
  const inviteUrlLoader = useIfCloud(useInviteUrlLoader)
  const createWorkspaceUrlLoader = useIfCloud(useCreateWorkspaceUrlLoader)
  const pricingTableUrlLoader = useIfCloud(usePricingTableUrlLoader)
  const topUpUrlLoader = useIfCloud(useTopUpUrlLoader)
  const settingsUrlLoader = useIfCloud(useSettingsUrlLoader)
  const assetsUrlLoader = useIfCloud(useAssetsUrlLoader)
  const localHandoffUrlLoader = useIfCloud(useLocalHandoffUrlLoader)
  const subscriptionDialog = useIfCloud(useSubscriptionDialog)

  const steps = isCloud
    ? buildUrlActionSteps(
        {
          workflowLinkUrlLoader,
          deploymentUrlLoader,
          workspaceUrlLoader,
          inviteUrlLoader,
          createWorkspaceUrlLoader,
          pricingTableUrlLoader,
          topUpUrlLoader,
          settingsUrlLoader,
          assetsUrlLoader,
          localHandoffUrlLoader
        },
        router
      )
    : []

  async function runUrlActionLoaders() {
    const interrupted = await runUrlActionSteps(steps)
    if (interrupted) return
    schedulePendingCheckoutRecovery(subscriptionDialog)
  }

  return { runUrlActionLoaders }
}
