import type { Page } from '@playwright/test'

import type { ObjectInfo } from '@e2e/fixtures/customNode/objectInfoValidator'
import type { RawPromptEvent } from '@e2e/fixtures/customNode/promptEventScope'
import {
  eventsForPrompt,
  toPromptEvent
} from '@e2e/fixtures/customNode/promptEventScope'
import type { PromptCapture } from '@e2e/fixtures/customNode/promptSubmission'
import {
  capturePromptResponse,
  describePromptRejection,
  serverSideFault
} from '@e2e/fixtures/customNode/promptSubmission'
import type { RunResult } from '@e2e/fixtures/customNode/runResult'
import { classifyRun } from '@e2e/fixtures/customNode/runResult'
import { onPromptIdResponse } from '@e2e/fixtures/utils/customNodeSuite'

export { isServerSideFault } from '@e2e/fixtures/customNode/promptSubmission'

const TERMINAL = [
  'execution_success',
  'execution_error',
  'execution_interrupted'
]

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
      proofOutputNodeByExpectedNode?: Record<string, string>
      timeoutMs: number
    }
  ): Promise<RunResult> {
    await page.evaluate(
      (types) => {
        const sink = window as unknown as {
          __cnEvents: RawPromptEvent[]
          __cnTapInstalled?: boolean
        }
        sink.__cnEvents = []
        if (sink.__cnTapInstalled) return
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
      },
      [
        'execution_start',
        ...TERMINAL,
        'executing',
        'execution_cached',
        'executed'
      ]
    )

    // A backend rejection answers /prompt with a non-2xx body carrying
    // { error, node_errors }. app.queuePrompt swallows it and just returns
    // false, so without capturing it here the verdict names nothing. The
    // status is kept alongside the summarized body because it decides
    // attribution (see PromptRejection).
    let capture: PromptCapture = { sequence: 0 }
    const { detach: stopCapture, settled: captureSettled } = onPromptIdResponse(
      page,
      (promptId, body, status, sequence) => {
        capture = capturePromptResponse(capture, {
          sequence,
          status,
          body,
          promptId
        })
      }
    )

    const queued = await page.evaluate(async () => {
      try {
        return await window.app!.queuePrompt(0)
      } catch (error) {
        return { __cnThrew: String(error) || 'pack threw an empty error' }
      }
    })
    const refused = (
      result: unknown
    ): result is false | { __cnThrew: string } =>
      result === false ||
      (typeof result === 'object' && result !== null && '__cnThrew' in result)
    if (refused(queued)) {
      await captureSettled()
      stopCapture()
      if (capture.rejection !== undefined && capture.rejection.status >= 500)
        throw serverSideFault(capture.rejection)
      return {
        outcome: 'VALIDATION_FAIL',
        executedNodes: [],
        outputsByNode: {},
        clientError:
          (typeof queued === 'object' ? queued.__cnThrew : undefined) ??
          (capture.rejection && describePromptRejection(capture.rejection))
      }
    }

    // The submission resolved, so the /prompt response is in flight or done;
    // give its body-parse a bounded beat before snapshotting the id.
    await captureSettled()
    const captureDeadline = Date.now() + 2_000
    while (
      capture.promptId === undefined &&
      capture.rejection === undefined &&
      Date.now() < captureDeadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      await captureSettled()
    }
    if (capture.rejection !== undefined) {
      stopCapture()
      if (capture.rejection.status >= 500)
        throw serverSideFault(capture.rejection)
      return {
        outcome: 'VALIDATION_FAIL',
        executedNodes: [],
        outputsByNode: {},
        clientError: describePromptRejection(capture.rejection)
      }
    }
    if (capture.promptId === undefined) {
      stopCapture()
      throw new Error(
        'failed to capture the /prompt response id; backend events cannot be attributed safely'
      )
    }
    const promptId = capture.promptId

    await page
      .waitForFunction(
        ([terminal, activePromptId]) => {
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
              event.prompt_id === activePromptId
          )
        },
        [TERMINAL, promptId] as const,
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

    const captured = await page.evaluate(
      () =>
        (window as unknown as { __cnEvents?: RawPromptEvent[] }).__cnEvents ??
        []
    )
    const raw = eventsForPrompt(captured, promptId)
    const timedOut = !raw.some((event) => TERMINAL.includes(event.type))
    return classifyRun({
      events: raw.map(toPromptEvent),
      expectedNodeIds: opts.expectedNodeIds,
      proofOutputNodeByExpectedNode: opts.proofOutputNodeByExpectedNode,
      graphNodeIds: opts.graphNodeIds,
      timedOut
    })
  }
}
