import type { Page } from '@playwright/test'

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

    // app.queuePrompt (NOT api.queuePrompt: that submits an empty prompt).
    // false = validation reject (emits no events), but pack JS hooking the
    // queue can refuse transiently - retry once; real rejects fail twice.
    let queued = await page.evaluate(() => window.app!.queuePrompt(0))
    if (queued === false) {
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 250))
      )
      queued = await page.evaluate(() => window.app!.queuePrompt(0))
      if (queued === false)
        return {
          outcome: 'VALIDATION_FAIL',
          executedNodes: [],
          outputsByNode: {}
        }
    }

    await page
      .waitForFunction(
        ([terminal, seen, graphIds]) => {
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
              !(event.prompt_id && seen.includes(event.prompt_id)) &&
              (graphIds === null ||
                event.node_id === undefined ||
                graphIds.includes(event.node_id))
          )
        },
        [TERMINAL, seenPromptIds ?? [], opts.graphNodeIds ?? null] as const,
        { timeout: opts.timeoutMs }
      )
      .catch((error: unknown) => {
        // Only a Playwright wait timeout means "no terminal event"; surface any
        // other fault instead of masquerading it as a run TIMEOUT.
        if (error instanceof Error && error.name === 'TimeoutError') return
        throw error
      })

    const raw = (
      await page.evaluate(
        () =>
          (window as unknown as { __cnEvents?: RawEvent[] }).__cnEvents ?? []
      )
    ).filter(
      (event) =>
        !(event.prompt_id && (seenPromptIds ?? []).includes(event.prompt_id))
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
