import type { Page, Request, Response } from '@playwright/test'

import type {
  ActivePathPointer,
  DraftIndexV2,
  DraftPayloadV2,
  OpenPathsPointer
} from '@/platform/workflow/persistence/base/draftTypes'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

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

// The suite restores a pre-seeded blank draft instead of the bundled
// default graph, whose model references error on the model-less backend.
// The restored startup outcome also prevents onboarding without a reload.
// The shared fixture disables the errors tab to hide missing-model
// indicators in unrelated suites; this suite exists to SEE errors, so every
// error surface stays live.
export const customNodeSuiteSettings = {
  'Comfy.TutorialCompleted': true,
  'Comfy.Workflow.Persist': true,
  'Comfy.RightSidePanel.ShowErrorsTab': true
}

/**
 * Watches this page's `/prompt` POSTs, handing each response's `prompt_id`
 * (undefined when the body carries none) plus the raw body and status to
 * `handle`. `settled` resolves once every response seen so far has been
 * parsed, which is what lets a caller read a complete id ledger.
 */
export function onPromptIdResponse(
  page: Page,
  handle: (
    promptId: string | undefined,
    body: unknown,
    status: number,
    sequence: number
  ) => void
): { detach: () => void; settled: () => Promise<void> } {
  const parsing = new Set<Promise<void>>()
  let sequence = 0
  const listener = (response: Response) => {
    if (response.request().method() !== 'POST') return
    if (!new URL(response.url()).pathname.endsWith('/prompt')) return
    const responseSequence = ++sequence
    parsing.add(
      response
        .json()
        .then((body: unknown) => {
          const id = (body as { prompt_id?: unknown } | null)?.prompt_id
          handle(
            typeof id === 'string' ? id : undefined,
            body,
            response.status(),
            responseSequence
          )
        })
        .catch(() => {
          if (response.status() >= 400)
            handle(undefined, undefined, response.status(), responseSequence)
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
  submissions: number
}

function isPromptPost(request: Request): boolean {
  return (
    request.method() === 'POST' &&
    new URL(request.url()).pathname.endsWith('/prompt')
  )
}

// Backends are shared - two workers, two CI runs - so an unscoped
// interrupt(null) + clearItems('queue') cancels another client's in-flight
// prompt. This ledger is what lets the drain below touch only what this
// page submitted.
const promptLedgers = new WeakMap<Page, PromptLedger>()

/**
 * Starts recording this page's `/prompt` submissions. Install in `beforeEach`,
 * before anything queues: {@link drainBackendToIdle} refuses to run without the
 * ledger rather than silently degrading to cleaning nothing up.
 */
export function trackSubmittedPrompts(page: Page): void {
  if (promptLedgers.has(page)) return
  const ids = new Set<string>()
  const ledger: PromptLedger = { ids, settled: async () => {}, submissions: 0 }
  page.on('request', (request) => {
    if (isPromptPost(request)) ledger.submissions++
  })
  const { settled } = onPromptIdResponse(page, (promptId) => {
    if (promptId !== undefined) ids.add(promptId)
  })
  ledger.settled = settled
  promptLedgers.set(page, ledger)
}

export async function submittedPromptCount(page: Page): Promise<number> {
  const ledger = promptLedgers.get(page)
  if (!ledger)
    throw new Error(
      'submittedPromptCount: no prompt ledger for this page - call trackSubmittedPrompts(page) in beforeEach'
    )
  await ledger.settled()
  return ledger.submissions
}

interface QueueIds {
  running: string[]
  pending: string[]
}

export function ownedQueueEntries(
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
