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
    opts: { expectedNodeIds: string[]; timeoutMs: number }
  ): Promise<RunResult> {
    await page.evaluate(
      (types) => {
        const sink = window as unknown as {
          __cnEvents: RawEvent[]
          __cnTapInstalled?: boolean
        }
        sink.__cnEvents = []
        if (sink.__cnTapInstalled) return
        sink.__cnTapInstalled = true
        for (const type of types)
          (window.app!.api as EventTarget).addEventListener(
            type,
            (event: Event) =>
              sink.__cnEvents.push({
                type,
                ...(event as CustomEvent).detail
              })
          )
      },
      ['execution_start', ...TERMINAL, 'executing']
    )

    // Browser path: app.queuePrompt runs graphToPrompt internally. Do NOT call
    // app.api.queuePrompt, which submits an already-serialized (empty) prompt.
    await page.evaluate(() => window.app!.queuePrompt(0))

    await page
      .waitForFunction(
        (terminal) => {
          const events =
            (window as unknown as { __cnEvents?: { type: string }[] })
              .__cnEvents ?? []
          return events.some((event) => terminal.includes(event.type))
        },
        TERMINAL,
        { timeout: opts.timeoutMs }
      )
      .catch((error: unknown) => {
        // Only a Playwright wait timeout means "no terminal event"; surface any
        // other fault instead of masquerading it as a run TIMEOUT.
        if (error instanceof Error && error.name === 'TimeoutError') return
        throw error
      })

    const raw = await page.evaluate(
      () => (window as unknown as { __cnEvents?: RawEvent[] }).__cnEvents ?? []
    )
    const timedOut = !raw.some((event) => TERMINAL.includes(event.type))
    return classifyRun({
      events: raw.map(toPromptEvent),
      expectedNodeIds: opts.expectedNodeIds,
      timedOut
    })
  }
}
