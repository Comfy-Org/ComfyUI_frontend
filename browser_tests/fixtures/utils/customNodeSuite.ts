import type { Page, Response } from '@playwright/test'

import { customNodesEnv } from '@e2e/fixtures/customNode/manifest'
import type {
  ActivePathPointer,
  DraftIndexV2,
  DraftPayloadV2,
  OpenPathsPointer
} from '@/platform/workflow/persistence/base/draftTypes'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const CLOUD_CUSTOM_NODE_BOOT_COUNT = '__cloudCustomNodeBootCount'
const CLOUD_CUSTOM_NODE_ONBOARDING = '__cloudCustomNodeOnboarding'
const CLOUD_CUSTOM_NODE_OBSERVER = '__cloudCustomNodeObserver'
const ONBOARDING_SELECTOR =
  '[data-testid="template-filter-bar"], [data-testid="getting-started-blank"]'
const CUSTOM_NODE_BLANK_WORKFLOW_PATH =
  'workflows/Custom Nodes E2E Blank Workflow.json'
// Importing blankGraph evaluates import.meta.env in Playwright's Node process.
const CUSTOM_NODE_BLANK_GRAPH: ComfyWorkflowJSON = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

export async function installCustomNodeBlankStartup(page: Page): Promise<void> {
  const workspaceId = 'personal'
  const path = CUSTOM_NODE_BLANK_WORKFLOW_PATH
  const draftKey = StorageKeys.draftKey(path)
  const updatedAt = Date.now()
  const index: DraftIndexV2 = {
    v: 2,
    updatedAt,
    order: [draftKey],
    entries: {
      [draftKey]: {
        path,
        name: 'Custom Nodes E2E Blank Workflow.json',
        isTemporary: true,
        updatedAt
      }
    }
  }
  const payload: DraftPayloadV2 = {
    data: JSON.stringify(CUSTOM_NODE_BLANK_GRAPH),
    updatedAt
  }
  const active: ActivePathPointer = { workspaceId, path }
  const open: OpenPathsPointer = {
    workspaceId,
    paths: [path],
    activeIndex: 0
  }
  const entries = [
    [StorageKeys.draftIndex(workspaceId), JSON.stringify(index)],
    [StorageKeys.draftPayload(path, workspaceId), JSON.stringify(payload)],
    [StorageKeys.lastActivePath(workspaceId), JSON.stringify(active)],
    [StorageKeys.lastOpenPaths(workspaceId), JSON.stringify(open)]
  ]
  await page.addInitScript((entries) => {
    for (const [key, value] of entries) localStorage.setItem(key, value)
  }, entries)
}

export async function installCloudCustomNodeBootGuard(
  page: Page
): Promise<void> {
  await page.addInitScript(
    ({ bootCountKey, onboardingKey, observerKey, onboardingSelector }) => {
      if (window !== window.top || location.pathname !== '/') return
      const count = Number(sessionStorage.getItem(bootCountKey) ?? '0')
      sessionStorage.setItem(bootCountKey, String(count + 1))

      const record = (node: Node | null) => {
        if (!(node instanceof Element)) return
        const surface = node.matches(onboardingSelector)
          ? node
          : node.querySelector(onboardingSelector)
        const testId = surface?.getAttribute('data-testid')
        if (testId !== null && testId !== undefined)
          sessionStorage.setItem(onboardingKey, testId)
      }
      record(document.documentElement)
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.type === 'attributes' &&
            (mutation.oldValue === 'template-filter-bar' ||
              mutation.oldValue === 'getting-started-blank')
          )
            sessionStorage.setItem(onboardingKey, mutation.oldValue)
          record(mutation.target)
          for (const node of mutation.addedNodes) record(node)
        }
      })
      observer.observe(document, {
        attributes: true,
        attributeFilter: ['data-testid'],
        attributeOldValue: true,
        childList: true,
        subtree: true
      })
      Reflect.set(window, observerKey, observer)
    },
    {
      bootCountKey: CLOUD_CUSTOM_NODE_BOOT_COUNT,
      onboardingKey: CLOUD_CUSTOM_NODE_ONBOARDING,
      observerKey: CLOUD_CUSTOM_NODE_OBSERVER,
      onboardingSelector: ONBOARDING_SELECTOR
    }
  )
}

export function readCloudCustomNodeBootGuard(
  page: Page
): Promise<{ bootCount: number; onboarding: string | null }> {
  return page.evaluate(
    ({ bootCountKey, onboardingKey }) => ({
      bootCount: Number(sessionStorage.getItem(bootCountKey) ?? '0'),
      onboarding: sessionStorage.getItem(onboardingKey)
    }),
    {
      bootCountKey: CLOUD_CUSTOM_NODE_BOOT_COUNT,
      onboardingKey: CLOUD_CUSTOM_NODE_ONBOARDING
    }
  )
}

export function assertCloudCustomNodeBootGuard({
  bootCount,
  onboarding
}: {
  bootCount: number
  onboarding: string | null
}): void {
  if (bootCount !== 1)
    throw new Error(
      `cloud custom-node setup booted the app ${bootCount} times; expected exactly one pre-seeded boot`
    )
  if (onboarding !== null)
    throw new Error(
      `cloud custom-node setup opened ${onboarding} despite pre-seeded startup settings`
    )
}

function stopCloudCustomNodeBootGuard(page: Page): Promise<void> {
  return page.evaluate((observerKey) => {
    const observer = Reflect.get(window, observerKey)
    if (observer instanceof MutationObserver) observer.disconnect()
    Reflect.deleteProperty(window, observerKey)
  }, CLOUD_CUSTOM_NODE_OBSERVER)
}

export interface CloudCustomNodeBootGuardActions {
  read: typeof readCloudCustomNodeBootGuard
  assert: typeof assertCloudCustomNodeBootGuard
  stop: typeof stopCloudCustomNodeBootGuard
}

const cloudCustomNodeBootGuardActions: CloudCustomNodeBootGuardActions = {
  read: readCloudCustomNodeBootGuard,
  assert: assertCloudCustomNodeBootGuard,
  stop: stopCloudCustomNodeBootGuard
}

export async function finalizeCloudCustomNodeBootGuard(
  page: Page,
  actions: CloudCustomNodeBootGuardActions = cloudCustomNodeBootGuardActions
): Promise<void> {
  if (page.isClosed())
    throw new Error('cloud custom-node boot guard unavailable: page closed')

  const errors: unknown[] = []
  try {
    actions.assert(await actions.read(page))
  } catch (error) {
    errors.push(error)
  }
  try {
    await actions.stop(page)
  } catch (error) {
    errors.push(error)
  }
  throwCollectedErrors(errors)
}

function throwCollectedErrors(errors: readonly unknown[]): void {
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1)
    throw new AggregateError(errors, 'test and fixture teardown failed')
}

export async function runWithCollectedCleanup(
  run: () => Promise<void>,
  cleanups: readonly (() => Promise<void>)[]
): Promise<void> {
  const errors: unknown[] = []
  try {
    await run()
  } catch (error) {
    errors.push(error)
  }
  for (const cleanup of cleanups) {
    try {
      await cleanup()
    } catch (error) {
      errors.push(error)
    }
  }
  throwCollectedErrors(errors)
}

// Both environments restore a pre-seeded blank draft instead of the bundled
// default graph, whose model references error on the model-less Core backend.
// The restored startup outcome also prevents onboarding without a reload.
// The shared fixture disables the errors tab to hide missing-model
// indicators in unrelated suites; this suite exists to SEE errors, so every
// error surface stays live.
export function customNodeSuiteSettingsFor(_env: 'core' | 'cloud') {
  return {
    'Comfy.TutorialCompleted': true,
    'Comfy.Workflow.Persist': true,
    'Comfy.RightSidePanel.ShowErrorsTab': true
  }
}

export const customNodeSuiteSettings =
  customNodeSuiteSettingsFor(customNodesEnv())

/**
 * Watches this page's `/prompt` POSTs, handing each response's `prompt_id`
 * (undefined when the body carries none) plus the raw body and status to
 * `handle`. `settled` resolves once every response seen so far has been
 * parsed, which is what lets a caller read a complete id ledger.
 */
export function onPromptIdResponse(
  page: Page,
  handle: (promptId: string | undefined, body: unknown, status: number) => void
): { detach: () => void; settled: () => Promise<void> } {
  const parsing = new Set<Promise<void>>()
  const listener = (response: Response) => {
    if (response.request().method() !== 'POST') return
    if (!new URL(response.url()).pathname.endsWith('/prompt')) return
    parsing.add(
      response
        .json()
        .then((body: unknown) => {
          const id = (body as { prompt_id?: unknown } | null)?.prompt_id
          handle(
            typeof id === 'string' ? id : undefined,
            body,
            response.status()
          )
        })
        .catch(() => {
          // a rejection carries no prompt_id, and an empty or proxy-HTML body
          // fails to parse; neither reached the queue
        })
    )
  }
  page.on('response', listener)
  return {
    detach: () => page.off('response', listener),
    settled: async () => {
      await Promise.allSettled([...parsing])
    }
  }
}

interface PromptLedger {
  ids: Set<string>
  settled: () => Promise<void>
}

// Backends are shared - two workers, two CI runs, and today every cloud run
// signs in as the same smoke account - so an unscoped interrupt(null) +
// clearItems('queue') cancels another client's in-flight prompt. This ledger
// is what lets the drain below touch only what this page submitted.
const promptLedgers = new WeakMap<Page, PromptLedger>()

/**
 * Starts recording this page's `/prompt` submissions. Install in `beforeEach`,
 * before anything queues: {@link drainBackendToIdle} refuses to run without the
 * ledger rather than silently degrading to cleaning nothing up.
 */
export function trackSubmittedPrompts(page: Page): void {
  if (promptLedgers.has(page)) return
  const ids = new Set<string>()
  const { settled } = onPromptIdResponse(page, (promptId) => {
    if (promptId !== undefined) ids.add(promptId)
  })
  promptLedgers.set(page, { ids, settled })
}

interface QueueIds {
  running: string[]
  pending: string[]
}

function ownedQueueEntries(
  queue: QueueIds,
  ownedIds: ReadonlySet<string>
): QueueIds {
  return {
    running: queue.running.filter((id) => ownedIds.has(id)),
    pending: queue.pending.filter((id) => ownedIds.has(id))
  }
}

function readQueueIds(page: Page): Promise<QueueIds> {
  return page.evaluate(async () => {
    const { Running, Pending } = await window.app!.api.getQueue({
      throwOnError: true
    })
    return {
      running: Running.map((job) => job.id),
      pending: Pending.map((job) => job.id)
    }
  })
}

function sleep(page: Page): Promise<unknown> {
  return page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)))
}

// Every test gets a fresh page, but they share ONE backend. An execution
// tier that ends while a prompt is still draining leaves that work running
// on the shared backend; the next test's fresh page connects mid-execution
// and catches its async error events (console noise, a popped error dialog)
// or its still-running prompt (queue-busy). Draining to idle in an afterEach
// - while the finishing test's own page is still open, so any late events
// land there - is what makes each test unable to affect the next.
// Scope is this page's own prompts, for both the cancelling and the result: a
// co-tenant's busy queue is neither cleared nor charged to us, and leftovers
// from an earlier test on the shared backend need waitForQueueQuiet instead.
// Cancellation repeats each poll because a pending entry can be promoted to
// running between the read and the delete.
// Returns 0 when this page's work reached idle, 1 when it was still busy after
// the budget (a genuinely wedged, non-interruptible execution).
export async function drainBackendToIdle(
  page: Page,
  budgetMs = 150_000
): Promise<number> {
  const ledger = promptLedgers.get(page)
  if (!ledger)
    throw new Error(
      'drainBackendToIdle: no prompt ledger for this page - call trackSubmittedPrompts(page) in beforeEach'
    )
  // A submission whose response body is still parsing is not in ids yet, and
  // reading past it would report this page as having nothing to clean up.
  await ledger.settled()
  if (ledger.ids.size === 0) return 0

  const deadline = Date.now() + budgetMs
  let owned = ownedQueueEntries(await readQueueIds(page), ledger.ids)
  while (owned.running.length + owned.pending.length > 0) {
    await page.evaluate(async ({ running, pending }) => {
      for (const id of running) await window.app!.api.interrupt(id)
      for (const id of pending) await window.app!.api.deleteItem('queue', id)
    }, owned)
    if (Date.now() >= deadline) return 1
    await sleep(page)
    owned = ownedQueueEntries(await readQueueIds(page), ledger.ids)
  }
  return 0
}

/**
 * Polls until the WHOLE backend queue is empty, cancelling nothing. Use this
 * where the work being waited on is not this page's own - a previous test's
 * still-draining execution on the shared backend, which
 * {@link drainBackendToIdle} cannot see and must not cancel. Returns 0 when
 * the queue emptied, 1 when it was still busy after the budget.
 */
export async function waitForQueueQuiet(
  page: Page,
  budgetMs: number
): Promise<number> {
  const depth = async () => {
    const { running, pending } = await readQueueIds(page)
    return running.length + pending.length
  }
  const deadline = Date.now() + budgetMs
  let remaining = await depth()
  while (remaining !== 0 && Date.now() < deadline) {
    await sleep(page)
    remaining = await depth()
  }
  return remaining === 0 ? 0 : 1
}
