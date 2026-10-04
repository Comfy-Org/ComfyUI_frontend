import type { WebSocketRoute } from '@playwright/test'

import type {
  NodeError,
  PromptFailureResponse
} from '@/platform/remote/comfyui/types'
import type { NodeProgressState } from '@/platform/remote/comfyui/execution/types'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'

const PROMPT_ROUTE_PATTERN = /\/api\/prompt$/

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  )
}

type RunOptions = {
  nodeErrors?: Record<string, NodeError>
  onPromptRequest?: (requestBody: unknown) => void | Promise<void>
  beforePromptResponse?: (jobId: string) => void | Promise<void>
}

/**
 * Build a `NodeError` describing a single failed input on a KSampler node.
 * Shared between specs that surface validation rings via 400 responses.
 */
export function buildKSamplerError(
  type: NodeError['errors'][number]['type'],
  inputName: string,
  message: string
): NodeError {
  return {
    class_type: 'KSampler',
    dependent_outputs: [],
    errors: [
      {
        type,
        message,
        details: '',
        extra_info: { input_name: inputName }
      }
    ]
  }
}

/**
 * Helper for simulating prompt execution in e2e tests.
 */
export class ExecutionHelper {
  private jobCounter = 0
  private metadata: Record<string, unknown> | undefined
  private scopeOpen = false
  private readonly completedJobs: RawJobListItem[] = []
  private readonly page: ComfyPage['page']
  private readonly command: ComfyPage['command']
  private readonly assets: ComfyPage['assets']

  constructor(
    comfyPage: ComfyPage,
    private readonly ws?: WebSocketRoute
  ) {
    this.page = comfyPage.page
    this.command = comfyPage.command
    this.assets = comfyPage.assets
  }

  private requireWs(): WebSocketRoute {
    if (!this.ws) {
      throw new Error(
        'ExecutionHelper was constructed without a WebSocketRoute; ' +
          'pass `ws` to use methods that send WS frames.'
      )
    }
    return this.ws
  }

  /**
   * Stamp `workflow_id` on every eligible JSON frame sent inside `fn`, the way
   * core's `send_sync` spreads a prompt's `workflow_metadata` onto outgoing
   * messages. Leave `workflowId` undefined to emit frames the way a core build
   * without that support does — the legacy backend profile.
   */
  withWorkflowId<T>(workflowId: string | undefined, fn: () => T): T {
    return this.withMetadata(
      workflowId === undefined ? undefined : { workflow_id: workflowId },
      fn
    )
  }

  /**
   * The general form of {@link withWorkflowId}: core accepts an arbitrary
   * `workflow_metadata` dict, so a scenario can set keys that collide with a
   * frame's own fields and assert the frame still wins.
   *
   * The scope survives `await`s inside `fn`. A callback that returns a promise
   * keeps the scope open until that promise settles, so frames emitted after an
   * `await` are still stamped — returning the promise used to restore the
   * previous scope immediately, silently unstamping (or mis-stamping) every
   * frame after the first suspension point.
   *
   * The scope is ambient for as long as it is open, not lexical to `fn`: a frame
   * emitted from anywhere while an async scope is pending is stamped with it.
   * That is the point — it models core holding a prompt's `workflow_metadata`
   * for the duration of the run — but it means an un-awaited scope keeps
   * stamping, so always await the returned promise.
   *
   * **Exactly one scope may be open at a time, and a second one throws** —
   * whether it overlaps an async scope or is nested inside `fn`. Without
   * ambient async context two live scopes cannot be attributed to their
   * prompts, and the wrong `workflow_id` on a frame is precisely the bug this
   * harness exists to catch. Nesting used to slip past this guard and was
   * worse than ambiguous: the inner scope's `finally` restored *its* saved
   * value, so an outer scope that had already closed came back to life and
   * stamped every later frame for the rest of the test. Await the first scope,
   * or script the prompts as separate synchronous frames via
   * `BackendSimulator`.
   */
  withMetadata<T>(
    metadata: Record<string, unknown> | undefined,
    fn: () => T
  ): T {
    if (this.scopeOpen) {
      throw new Error(
        'ExecutionHelper: a metadata scope is already in flight. ' +
          'Await it before opening another one, and do not nest them.'
      )
    }

    const previous = this.metadata
    this.metadata = metadata
    // Set before `fn` runs, so a scope opened synchronously inside it is
    // rejected too. Setting it afterwards only caught the overlapping-async
    // case and left nesting — the strictly worse one — unguarded.
    this.scopeOpen = true
    const restore = () => {
      this.scopeOpen = false
      this.metadata = previous
    }

    let result: T
    try {
      result = fn()
    } catch (error) {
      restore()
      throw error
    }

    if (!isPromiseLike(result)) {
      restore()
      return result
    }

    // Cast: `T` is promise-like here, and the returned promise settles with the
    // same value or rejection, only after the scope has been restored.
    return Promise.resolve(result).finally(restore) as T
  }

  /**
   * Metadata first so a frame's own fields always win on collision, matching
   * core's `{**workflow_metadata, **data}`.
   *
   * Only frames carrying a `prompt_id` are stamped, which is core's own gate
   * (`send_sync` checks `"prompt_id" in data`) rather than an event-name
   * carve-out. `status` is exempt because it has no `prompt_id`, so the
   * exemption cannot drift out of sync with the list of frame builders.
   */
  private emit(type: string, data: Record<string, unknown>): void {
    const payload =
      this.metadata && 'prompt_id' in data
        ? { ...this.metadata, ...data }
        : data
    this.requireWs().send(JSON.stringify({ type, data: payload }))
  }

  /**
   * Intercept POST /api/prompt, execute Comfy.QueuePrompt, and return
   * the synthetic job ID.
   *
   * The app receives a valid PromptResponse so storeJob() fires
   * and registers the job against the active workflow path.
   */
  async run(options: RunOptions = {}): Promise<string> {
    const jobId = `test-job-${++this.jobCounter}`
    const { nodeErrors = {}, onPromptRequest, beforePromptResponse } = options

    let fulfilled!: () => void
    const prompted = new Promise<void>((r) => {
      fulfilled = r
    })

    await this.page.route(
      PROMPT_ROUTE_PATTERN,
      async (route) => {
        await onPromptRequest?.(route.request().postDataJSON())
        await beforePromptResponse?.(jobId)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            prompt_id: jobId,
            node_errors: nodeErrors
          })
        })
        fulfilled()
      },
      { times: 1 }
    )

    await this.command.executeCommand('Comfy.QueuePrompt')
    await prompted

    return jobId
  }

  async mockValidationFailure(
    nodeErrors: Record<string, NodeError>
  ): Promise<void> {
    const response: PromptFailureResponse = {
      node_errors: nodeErrors,
      error: {
        type: 'prompt_outputs_failed_validation',
        message: 'Prompt outputs failed validation',
        details: ''
      }
    }

    await this.page.route(
      PROMPT_ROUTE_PATTERN,
      async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      },
      { times: 1 }
    )
  }

  /**
   * Send a binary `b_preview_with_metadata` WS message (type 4).
   * Encodes the metadata and a tiny 1x1 PNG so the app creates a blob URL.
   */
  latentPreview(jobId: string, nodeId: string): void {
    const metadata = JSON.stringify({
      node_id: nodeId,
      display_node_id: nodeId,
      parent_node_id: nodeId,
      real_node_id: nodeId,
      prompt_id: jobId,
      image_type: 'image/png'
    })
    const metadataBytes = new TextEncoder().encode(metadata)

    // 1x1 red PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )

    // Binary format: [type:uint32][metadataLength:uint32][metadata][imageData]
    const buf = new ArrayBuffer(8 + metadataBytes.length + png.length)
    const view = new DataView(buf)
    view.setUint32(0, 4) // type 4 = PREVIEW_IMAGE_WITH_METADATA
    view.setUint32(4, metadataBytes.length)
    new Uint8Array(buf, 8, metadataBytes.length).set(metadataBytes)
    new Uint8Array(buf, 8 + metadataBytes.length).set(png)

    this.requireWs().send(Buffer.from(buf))
  }

  /** Send `execution_start` WS event. */
  executionStart(jobId: string): void {
    this.emit('execution_start', { prompt_id: jobId, timestamp: Date.now() })
  }

  /**
   * Send `executing` WS event to signal which node is currently running.
   *
   * Shape matches the server: a node-start frame carries `display_node`
   * (execution.py), the terminal `node: null` frame does not (main.py). The
   * app reads `display_node || node`, so omitting it would silently exercise
   * the fallback instead of the normal path.
   */
  executing(jobId: string, nodeId: string | null): void {
    this.emit('executing', {
      prompt_id: jobId,
      node: nodeId,
      ...(nodeId !== null && { display_node: nodeId })
    })
  }

  /** Send `executed` WS event with node output. */
  executed(
    jobId: string,
    nodeId: string,
    output: Record<string, unknown> | null | undefined
  ): void {
    this.emit('executed', {
      prompt_id: jobId,
      node: nodeId,
      display_node: nodeId,
      output
    })
  }

  /** Send `execution_success` WS event. */
  executionSuccess(jobId: string): void {
    this.emit('execution_success', { prompt_id: jobId, timestamp: Date.now() })
  }

  /** Send `execution_error` WS event. */
  executionError(jobId: string, nodeId: string, message: string): void {
    this.emit('execution_error', {
      prompt_id: jobId,
      timestamp: Date.now(),
      node_id: nodeId,
      node_type: 'Unknown',
      exception_message: message,
      exception_type: 'RuntimeError',
      traceback: []
    })
  }

  /** Send `execution_interrupted` WS event (user-initiated stop). */
  executionInterrupted(jobId: string, nodeId: string): void {
    this.emit('execution_interrupted', {
      prompt_id: jobId,
      timestamp: Date.now(),
      node_id: nodeId,
      node_type: 'Unknown',
      executed: []
    })
  }

  /** Send `progress` WS event. */
  progress(jobId: string, nodeId: string, value: number, max: number): void {
    this.emit('progress', { prompt_id: jobId, node: nodeId, value, max })
  }

  /**
   * The `progress_state` payload for a single node in the `running` state.
   *
   * Exposed separately from {@link nodeRunning} so a caller that needs the two
   * events as individually schedulable frames can send them itself without
   * rebuilding this payload — see `SimulatedPrompt.nodeRunning`.
   */
  runningNodeState(
    jobId: string,
    nodeId: string,
    value: number,
    max: number
  ): Record<string, NodeProgressState> {
    return {
      [nodeId]: {
        node_id: nodeId,
        display_node_id: nodeId,
        real_node_id: nodeId,
        prompt_id: jobId,
        state: 'running',
        value,
        max
      }
    }
  }

  /**
   * Put a single node into the `running` state at the given step progress,
   * emitting both the `progress_state` and `progress` events the backend sends.
   */
  nodeRunning(jobId: string, nodeId: string, value: number, max: number): void {
    this.progressState(jobId, this.runningNodeState(jobId, nodeId, value, max))
    this.progress(jobId, nodeId, value, max)
  }

  /** Send `progress_state` WS event with per-node execution state. */
  progressState(jobId: string, nodes: Record<string, NodeProgressState>): void {
    this.emit('progress_state', { prompt_id: jobId, nodes })
  }

  /**
   * Complete a job by adding it to mock history, sending execution_success,
   * and triggering a history refresh via a status event.
   *
   * Requires an {@link AssetsHelper} to be passed in the constructor.
   */
  async completeWithHistory(
    jobId: string,
    nodeId: string,
    filename: string
  ): Promise<void> {
    this.completedJobs.push(
      createMockJob({
        id: jobId,
        preview_output: {
          filename,
          subfolder: '',
          type: 'output',
          nodeId,
          mediaType: 'images'
        }
      })
    )

    await this.assets.mockOutputHistory(this.completedJobs)
    this.executionSuccess(jobId)
    // Trigger queue/history refresh
    this.status(0)
  }

  /**
   * Send `status` WS event to update queue count.
   *
   * Goes through {@link emit} like every other frame and comes out unstamped
   * because it carries no `prompt_id` — core exempts it for exactly that
   * reason: one server-wide socket serves every workflow, so a queue frame has
   * no single owner. Routing it through `emit` is what makes the exemption
   * testable; sending it directly would make any assertion about it vacuous.
   */
  status(queueRemaining: number): void {
    this.emit('status', {
      status: { exec_info: { queue_remaining: queueRemaining } }
    })
  }
}
