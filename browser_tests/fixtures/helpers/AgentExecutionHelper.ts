import type { Page } from '@playwright/test'

import type { PromptResponse } from '@/platform/remote/comfyui/types'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

import type { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AssetsHelper, createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

const PROMPT_ROUTE_PATTERN = /\/api\/prompt$/

/**
 * Queue and execution surface for the black-box agent harness.
 *
 * Install it after the rest of the harness so its routes win: Playwright runs
 * the most-recently-registered matching handler first.
 */
export class AgentExecutionHelper {
  private readonly jobs = new Map<string, RawJobListItem>()
  private readonly viewFiles: Partial<
    Record<string, { body?: Buffer; contentType?: string }>
  > = {}
  private readonly assets: AssetsHelper
  private readonly submitted: unknown[] = []
  private jobCounter = 0

  constructor(
    private readonly page: Page,
    private readonly hostSocket: AgentFollowerHostSocket
  ) {
    this.assets = new AssetsHelper(page)
  }

  async install(): Promise<void> {
    await mockViewFiles(this.page, this.viewFiles)
    await this.assets.mockOutputHistory([])
    await this.page.route(PROMPT_ROUTE_PATTERN, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      this.submitted.push(route.request().postDataJSON())
      const jobId = `agent-exec-job-${++this.jobCounter}`
      await this.upsertJob({
        id: jobId,
        status: 'pending',
        preview_output: null,
        outputs_count: null,
        execution_start_time: null,
        execution_end_time: null
      })
      const response: PromptResponse = {
        prompt_id: jobId,
        number: this.jobCounter,
        node_errors: {}
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })
  }

  submittedPrompts(): readonly unknown[] {
    return this.submitted
  }

  lastSubmittedJobId(): string {
    if (this.jobCounter === 0) throw new Error('no prompt was submitted')
    return `agent-exec-job-${this.jobCounter}`
  }

  /**
   * Registers a job the client never posted — the agent's own `run` tool
   * submits server-side, so the browser first learns of that job from the
   * queue surface.
   */
  async enqueueServerRun(jobId: string): Promise<void> {
    await this.upsertJob({
      id: jobId,
      status: 'pending',
      preview_output: null,
      outputs_count: null,
      execution_start_time: null,
      execution_end_time: null
    })
  }

  async startJob(jobId: string): Promise<void> {
    await this.upsertJob({
      id: jobId,
      status: 'in_progress',
      preview_output: null,
      outputs_count: null,
      execution_start_time: Date.now(),
      execution_end_time: null
    })
    this.hostSocket.sendExecution({
      type: 'execution_start',
      data: { prompt_id: jobId, timestamp: Date.now() }
    })
    this.status(1)
  }

  /**
   * Completes a job with one image output: the file becomes fetchable from
   * `/api/view`, the `executed` frame carries it to the node's preview, the
   * job's history row gains a `preview_output`, and the closing
   * `execution_success` plus `status` frames trigger the queue refresh —
   * the full "the run finished and here is the output" observable set.
   */
  async completeJob(
    jobId: string,
    { nodeId, filename }: { nodeId: string; filename: string }
  ): Promise<void> {
    this.viewFiles[filename] = {}
    await this.upsertJob(
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
    this.hostSocket.sendExecution({
      type: 'executed',
      data: {
        prompt_id: jobId,
        node: nodeId,
        display_node: nodeId,
        output: { images: [{ filename, subfolder: '', type: 'output' }] }
      }
    })
    this.hostSocket.sendExecution({
      type: 'execution_success',
      data: { prompt_id: jobId, timestamp: Date.now() }
    })
    this.status(0)
  }

  async failJob(
    jobId: string,
    {
      nodeId,
      nodeType = 'KSampler',
      message
    }: { nodeId: string; nodeType?: string; message: string }
  ): Promise<void> {
    const error = {
      prompt_id: jobId,
      timestamp: Date.now(),
      node_id: nodeId,
      node_type: nodeType,
      executed: [],
      exception_message: message,
      exception_type: 'RuntimeError',
      traceback: [`RuntimeError: ${message}`],
      current_inputs: {},
      current_outputs: {}
    }
    await this.upsertJob({
      id: jobId,
      status: 'failed',
      preview_output: null,
      outputs_count: null,
      execution_start_time: Date.now() - 1000,
      execution_end_time: Date.now(),
      execution_error: error
    })
    this.hostSocket.sendExecution({ type: 'execution_error', data: error })
    this.status(0)
  }

  /**
   * Pins a job in a deterministic stalled state: visibly running at a frozen
   * step, with no terminal frame ever arriving. The stall is the *absence* of
   * further frames, so this is the whole fixture — nothing to await.
   */
  async stallJob(
    jobId: string,
    {
      nodeId,
      value = 5,
      max = 20
    }: { nodeId: string; value?: number; max?: number }
  ): Promise<void> {
    await this.startJob(jobId)
    this.hostSocket.sendExecution({
      type: 'progress_state',
      data: {
        prompt_id: jobId,
        nodes: {
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
    })
  }

  /** Sends a `status` frame, which is what triggers the queue refresh. */
  status(queueRemaining: number): void {
    this.hostSocket.sendExecution({
      type: 'status',
      data: { status: { exec_info: { queue_remaining: queueRemaining } } }
    })
  }

  private async upsertJob(
    job: Partial<RawJobListItem> & {
      id: string
      status?: RawJobListItem['status']
    }
  ): Promise<void> {
    const existing = this.jobs.get(job.id)
    const merged: RawJobListItem = {
      create_time: existing?.create_time ?? Date.now(),
      priority: 0,
      outputs_count: null,
      ...existing,
      ...job,
      status: job.status ?? existing?.status ?? 'pending'
    }
    this.jobs.set(job.id, merged)
    await this.assets.mockOutputHistory([...this.jobs.values()])
  }
}
