import type { Page, Response } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { customNodesEnv } from '@e2e/fixtures/customNode/manifest'
import { TestIds } from '@e2e/fixtures/selectors'

// Core boots with a blank graph instead of the bundled default template, whose
// model references error on the model-less harness backend. Cloud completes the
// tutorial and reloads after persisting the setting so its modal cannot cover
// pointer targets.
// The shared fixture disables the errors tab to hide missing-model
// indicators in unrelated suites; this suite exists to SEE errors, so every
// error surface stays live.
export function customNodeSuiteSettingsFor(env: 'core' | 'cloud') {
  return {
    'Comfy.TutorialCompleted': env === 'cloud',
    'Comfy.RightSidePanel.ShowErrorsTab': true
  }
}

export const customNodeSuiteSettings =
  customNodeSuiteSettingsFor(customNodesEnv())

// On Cloud, explicitly requesting TutorialCompleted also makes the shared
// fixture reload after persisting startup settings. Keep this defensive
// dismissal for backends that ignore or rename the setting: if no dialog
// appears within a short window, the blank graph is already ready.
export async function dismissTemplatesDialog(
  comfyPage: ComfyPage
): Promise<void> {
  const templates = comfyPage.page.getByTestId(TestIds.templates.content)
  try {
    await templates.waitFor({ state: 'visible', timeout: 5000 })
  } catch {
    return
  }
  await comfyPage.page.keyboard.press('Escape')
  await templates.waitFor({ state: 'hidden' })
}

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
