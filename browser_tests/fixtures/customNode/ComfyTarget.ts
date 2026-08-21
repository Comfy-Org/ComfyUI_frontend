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
    // A prior run's terminal event can arrive after its sink was read (late
    // websocket delivery, or a timed-out prompt finishing during this run).
    // Remember every prompt id already observed and ignore its events here,
    // so one node's failure is never attributed to the next node tested.
    const seenPromptIds = await page.evaluate(
      (types) => {
        const sink = window as unknown as {
          __cnEvents: RawPromptEvent[]
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
      [
        'execution_start',
        ...TERMINAL,
        'executing',
        'execution_cached',
        'executed'
      ]
    )

    // Positively identify THIS attempt: the /prompt POST response body
    // carries the prompt_id the backend assigned. When captured it becomes
    // the primary event filter; the seen-set above and the graph-membership
    // check below stay as defense in depth (capture can lose a race with a
    // transient refusal, and `executing` events carry no prompt id at all).
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
        await captureSettled()
        stopCapture()
        // A captured 5xx outranks a client-side throw: the backend
        // demonstrably failed this submission server-side.
        if (capture.rejection !== undefined && capture.rejection.status >= 500)
          throw serverSideFault(capture.rejection)
        return {
          outcome: 'VALIDATION_FAIL',
          executedNodes: [],
          outputsByNode: {},
          // A throw carries its own text; a bare `false` reject leaves only
          // the backend's node_errors captured off the /prompt response.
          clientError:
            (typeof queued === 'object' ? queued.__cnThrew : undefined) ??
            (capture.rejection && describePromptRejection(capture.rejection))
        }
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
    // A silent permanent miss would degrade every run to the legacy filters
    // with no signal - make the fallback observable in the runner output.
    if (capture.promptId === undefined)
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
          capture.promptId ?? null
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

    const captured = await page.evaluate(
      () =>
        (window as unknown as { __cnEvents?: RawPromptEvent[] }).__cnEvents ??
        []
    )
    const raw = eventsForPrompt(
      captured,
      capture.promptId,
      new Set(seenPromptIds ?? [])
    )
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
