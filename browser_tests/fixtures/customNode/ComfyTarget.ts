import type { Page, Response } from '@playwright/test'

import type { PromptResponse } from '@/schemas/apiSchema'

import type { ObjectInfo } from '@e2e/fixtures/customNode/objectInfoValidator'
import type {
  ExecutionError,
  PromptEvent,
  RunResult
} from '@e2e/fixtures/customNode/runResult'
import { classifyRun } from '@e2e/fixtures/customNode/runResult'

interface RawEvent {
  type: string
  node?: string | null
  prompt_id?: string
  output?: unknown
  exception_type?: string
  node_id?: string
  node_type?: string
  traceback?: string[]
}

const TERMINAL = [
  'execution_success',
  'execution_error',
  'execution_interrupted'
]

// The /prompt rejection body is the apiSchema PromptResponse shape
// ({ error: string | {message}, node_errors: { <nodeId>: { class_type,
// errors: [{ details, message }] } } }). Flatten it to a single line naming
// the node class and the failing input so a VALIDATION_FAIL result is
// actionable instead of an empty object. Exported for a pure unit test: the
// happy path never runs it, so without a test a regression here would rot the
// diagnostic back to `{}` silently.
export function summarizePromptError(body: unknown): string | undefined {
  const payload = body as Partial<PromptResponse> | null
  if (!payload || typeof payload !== 'object') return undefined
  const parts: string[] = []
  const topError = payload.error
  if (typeof topError === 'string') {
    if (topError) parts.push(topError)
  } else if (topError?.message) parts.push(topError.message)
  for (const [nodeId, nodeError] of Object.entries(payload.node_errors ?? {})) {
    const cls = nodeError.class_type || nodeId
    for (const err of nodeError.errors ?? []) {
      const detail = err.details || err.message
      if (detail) parts.push(`${cls}: ${detail}`)
    }
  }
  return parts.length > 0 ? parts.join('; ') : undefined
}

function toPromptEvent(raw: RawEvent): PromptEvent {
  if (raw.type === 'executing')
    return { type: 'executing', node: raw.node ?? null }
  if (raw.type === 'executed')
    return { type: 'executed', node: raw.node ?? null, output: raw.output }
  if (raw.type === 'execution_error' || raw.type === 'execution_interrupted') {
    const error: ExecutionError = {
      exceptionType: raw.exception_type,
      nodeId: raw.node_id,
      nodeType: raw.node_type,
      traceback: raw.traceback
    }
    return { type: raw.type, error }
  }
  return { type: raw.type as 'execution_start' | 'execution_success' }
}

/**
 * Drives a real ComfyUI backend through the running frontend. The verdict logic
 * lives in the pure `classifyRun`; this class is only the in-page IO plumbing.
 */
export class LocalDesktopTarget {
  async getObjectInfo(page: Page): Promise<ObjectInfo> {
    return await page.evaluate(async () => {
      const defs = await window.app!.api.getNodeDefs()
      const out: Record<
        string,
        { input?: { required?: Record<string, unknown> } }
      > = {}
      for (const [name, def] of Object.entries(defs)) {
        const required = (
          def as { input?: { required?: Record<string, unknown> } }
        ).input?.required
        out[name] = { input: { required } }
      }
      return out
    })
  }

  async runWorkflow(
    page: Page,
    opts: {
      expectedNodeIds: string[]
      graphNodeIds?: string[]
      timeoutMs: number
    }
  ): Promise<RunResult> {
    // A prior run's terminal event can arrive after its sink was read (late
    // websocket delivery, or a timed-out prompt finishing during this run).
    // Remember every prompt id already observed and ignore its events here,
    // so one node's failure is never attributed to the next node tested.
    const seenPromptIds = await page.evaluate(
      (types) => {
        const sink = window as unknown as {
          __cnEvents: RawEvent[]
          __cnSeenPromptIds?: string[]
          __cnTapInstalled?: boolean
        }
        const seen = new Set(sink.__cnSeenPromptIds ?? [])
        for (const event of sink.__cnEvents ?? [])
          if (event.prompt_id) seen.add(event.prompt_id)
        sink.__cnSeenPromptIds = [...seen]
        sink.__cnEvents = []
        if (sink.__cnTapInstalled) return sink.__cnSeenPromptIds
        sink.__cnTapInstalled = true
        for (const type of types)
          (window.app!.api as EventTarget).addEventListener(
            type,
            (event: Event) => {
              const detail: unknown = (event as CustomEvent).detail
              // `executing` dispatches a bare node-id string (api.ts
              // dispatchCustomEvent('executing', msg.data.node)); the other
              // events dispatch object payloads.
              sink.__cnEvents.push(
                detail !== null && typeof detail === 'object'
                  ? { type, ...(detail as Record<string, unknown>) }
                  : { type, node: (detail as string | undefined) ?? null }
              )
            }
          )
        return sink.__cnSeenPromptIds
      },
      ['execution_start', ...TERMINAL, 'executing', 'executed']
    )

    // Positively identify THIS attempt: the /prompt POST response body
    // carries the prompt_id the backend assigned. When captured it becomes
    // the primary event filter; the seen-set above and the graph-membership
    // check below stay as defense in depth (capture can lose a race with a
    // transient refusal, and `executing` events carry no prompt id at all).
    let capturedPromptId: string | undefined
    // A backend validation rejection answers /prompt with a non-2xx body
    // carrying { error, node_errors }. app.queuePrompt swallows it and just
    // returns false, so without capturing it here a VALIDATION_FAIL result
    // names nothing. Snapshot the failing node/input so the outcome is
    // actionable instead of an empty object.
    let capturedValidationError: string | undefined
    const onPromptResponse = (response: Response) => {
      if (response.request().method() !== 'POST') return
      if (!new URL(response.url()).pathname.endsWith('/prompt')) return
      response
        .json()
        .then((body: unknown) => {
          const id = (body as { prompt_id?: unknown } | null)?.prompt_id
          if (typeof id === 'string') capturedPromptId = id
          if (response.status() >= 400)
            capturedValidationError = summarizePromptError(body)
        })
        .catch(() => {
          // a refused submission answers with a non-JSON or error body;
          // the refusal path below already handles it
        })
    }
    page.on('response', onPromptResponse)
    const stopCapture = () => page.off('response', onPromptResponse)

    // app.queuePrompt (NOT api.queuePrompt: that submits an empty prompt).
    // false = validation reject (emits no events), but pack JS hooking the
    // queue can refuse transiently - retry once; real rejects fail twice.
    // Pack JS can also THROW mid-graphToPrompt on a graph shape it does not
    // expect; catch in-page so one bad node classifies as VALIDATION_FAIL
    // (with the exception text) instead of aborting the whole tier.
    const queueOnce = () =>
      page.evaluate(async () => {
        try {
          return await window.app!.queuePrompt(0)
        } catch (error) {
          // Never an empty string: an empty __cnThrew would nullish-coalesce
          // wrong downstream and blank the VALIDATION_FAIL message.
          return { __cnThrew: String(error) || 'pack threw an empty error' }
        }
      })
    const refused = (
      result: unknown
    ): result is false | { __cnThrew: string } =>
      result === false ||
      (typeof result === 'object' && result !== null && '__cnThrew' in result)
    let queued = await queueOnce()
    if (refused(queued)) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      queued = await queueOnce()
      if (refused(queued)) {
        stopCapture()
        return {
          outcome: 'VALIDATION_FAIL',
          executedNodes: [],
          outputsByNode: {},
          // A throw carries its own text; a bare `false` reject leaves only
          // the backend's node_errors captured off the /prompt response.
          clientError:
            (typeof queued === 'object' ? queued.__cnThrew : undefined) ??
            capturedValidationError
        }
      }
    }

    // The submission resolved, so the /prompt response is in flight or done;
    // give its body-parse a bounded beat before snapshotting the id.
    const captureDeadline = Date.now() + 2_000
    while (capturedPromptId === undefined && Date.now() < captureDeadline)
      await new Promise((resolve) => setTimeout(resolve, 50))
    // A silent permanent miss would degrade every run to the legacy filters
    // with no signal - make the fallback observable in the runner output.
    if (capturedPromptId === undefined)
      console.warn(
        '[customNodes] /prompt response id capture missed; falling back to seen-set filtering'
      )

    await page
      .waitForFunction(
        ([terminal, seen, graphIds, promptId]) => {
          const events =
            (
              window as unknown as {
                __cnEvents?: {
                  type: string
                  prompt_id?: string
                  node_id?: string
                }[]
              }
            ).__cnEvents ?? []
          return events.some(
            (event) =>
              terminal.includes(event.type) &&
              (promptId !== null
                ? event.prompt_id === promptId
                : !(event.prompt_id && seen.includes(event.prompt_id)) &&
                  (graphIds === null ||
                    event.node_id === undefined ||
                    graphIds.includes(event.node_id)))
          )
        },
        [
          TERMINAL,
          seenPromptIds ?? [],
          opts.graphNodeIds ?? null,
          capturedPromptId ?? null
        ] as const,
        { timeout: opts.timeoutMs }
      )
      .catch((error: unknown) => {
        // Only a Playwright wait timeout means "no terminal event"; surface any
        // other fault instead of masquerading it as a run TIMEOUT.
        if (error instanceof Error && error.name === 'TimeoutError') return
        stopCapture()
        throw error
      })
    stopCapture()

    const raw = (
      await page.evaluate(
        () =>
          (window as unknown as { __cnEvents?: RawEvent[] }).__cnEvents ?? []
      )
    ).filter((event) =>
      // Positive id match when captured (events without a prompt_id - bare
      // `executing` strings - stay, and graph membership still vets them);
      // otherwise the legacy seen-set exclusion.
      capturedPromptId !== undefined
        ? event.prompt_id === undefined || event.prompt_id === capturedPromptId
        : !(event.prompt_id && (seenPromptIds ?? []).includes(event.prompt_id))
    )
    const timedOut = !raw.some((event) => TERMINAL.includes(event.type))
    return classifyRun({
      events: raw.map(toPromptEvent),
      expectedNodeIds: opts.expectedNodeIds,
      graphNodeIds: opts.graphNodeIds,
      timedOut
    })
  }
}
