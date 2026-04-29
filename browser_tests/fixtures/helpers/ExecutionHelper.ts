import type { WebSocketRoute } from '@playwright/test'

import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'

/**
 * Helper for simulating prompt execution in e2e tests.
 */
export class ExecutionHelper {
  private jobCounter = 0
  private readonly completedJobs: RawJobListItem[] = []
  private readonly page: ComfyPage['page']
  private readonly command: ComfyPage['command']
  private readonly assets: ComfyPage['assets']

  constructor(
    comfyPage: ComfyPage,
    private readonly ws: WebSocketRoute
  ) {
    this.page = comfyPage.page
    this.command = comfyPage.command
    this.assets = comfyPage.assets
  }

  /**
   * Intercept POST /api/prompt, execute Comfy.QueuePrompt, and return
   * the synthetic job ID.
   *
   * The app receives a valid PromptResponse so storeJob() fires
   * and registers the job against the active workflow path.
   */
  async run(): Promise<string> {
    const jobId = `test-job-${++this.jobCounter}`

    let fulfilled!: () => void
    const prompted = new Promise<void>((r) => {
      fulfilled = r
    })

    await this.page.route(
      '**/api/prompt',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            prompt_id: jobId,
            node_errors: {}
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

    this.ws.send(Buffer.from(buf))
  }

  /** Send `execution_start` WS event. */
  executionStart(jobId: string): void {
    this.ws.send(
      JSON.stringify({
        type: 'execution_start',
        data: { prompt_id: jobId, timestamp: Date.now() }
      })
    )
  }

  /** Send `executing` WS event to signal which node is currently running. */
  executing(jobId: string, nodeId: string | null): void {
    this.ws.send(
      JSON.stringify({
        type: 'executing',
        data: { prompt_id: jobId, node: nodeId }
      })
    )
  }

  /** Send `executed` WS event with node output. */
  executed(
    jobId: string,
    nodeId: string,
    output: Record<string, unknown>
  ): void {
    this.ws.send(
      JSON.stringify({
        type: 'executed',
        data: {
          prompt_id: jobId,
          node: nodeId,
          display_node: nodeId,
          output
        }
      })
    )
  }

  /** Send `execution_success` WS event. */
  executionSuccess(jobId: string): void {
    this.ws.send(
      JSON.stringify({
        type: 'execution_success',
        data: { prompt_id: jobId, timestamp: Date.now() }
      })
    )
  }

  /** Send `execution_error` WS event. */
  executionError(jobId: string, nodeId: string, message: string): void {
    this.ws.send(
      JSON.stringify({
        type: 'execution_error',
        data: {
          prompt_id: jobId,
          timestamp: Date.now(),
          node_id: nodeId,
          node_type: 'Unknown',
          exception_message: message,
          exception_type: 'RuntimeError',
          traceback: []
        }
      })
    )
  }

  /** Send `progress` WS event. */
  progress(jobId: string, nodeId: string, value: number, max: number): void {
    this.ws.send(
      JSON.stringify({
        type: 'progress',
        data: { prompt_id: jobId, node: nodeId, value, max }
      })
    )
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

  /** Send `status` WS event to update queue count. */
  status(queueRemaining: number): void {
    this.ws.send(
      JSON.stringify({
        type: 'status',
        data: { status: { exec_info: { queue_remaining: queueRemaining } } }
      })
    )
  }
}
