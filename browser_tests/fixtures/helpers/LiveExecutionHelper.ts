import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

import { zJobDetail } from '@comfyorg/api-client/jobTypes'
import type { JobDetail } from '@comfyorg/api-client/jobTypes'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const frameSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown())
})

export class LiveExecutionHelper {
  readonly frames: (z.infer<typeof frameSchema> & { receivedAt: number })[] = []
  readonly requests: { method: string; url: string }[] = []
  readonly jobIds: string[] = []
  readonly historyByJob: Record<string, JobDetail> = {}

  constructor(
    page: Page,
    private readonly request: APIRequestContext,
    private readonly apiUrl: string
  ) {
    page.on('request', (request) => {
      this.requests.push({ method: request.method(), url: request.url() })
    })
    page.on('websocket', (socket) => {
      socket.on('framereceived', ({ payload }) => {
        if (typeof payload !== 'string') return
        const parsed = frameSchema.safeParse(JSON.parse(payload))
        if (parsed.success) {
          this.frames.push({ ...parsed.data, receivedAt: Date.now() })
        }
      })
    })
  }

  async run(comfyPage: ComfyPage): Promise<string> {
    const response = comfyPage.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/prompt' &&
        response.request().method() === 'POST'
    )
    await comfyPage.runButton.click()
    const submitted = await response
    expect(submitted.ok(), await submitted.text()).toBeTruthy()
    const data: unknown = await submitted.json()
    const { prompt_id: jobId } = z
      .object({ prompt_id: z.string().min(1) })
      .parse(data)
    this.jobIds.push(jobId)
    return jobId
  }

  hasEvent(jobId: string, type: string): boolean {
    return this.frames.some(
      (frame) => frame.type === type && frame.data.prompt_id === jobId
    )
  }

  hasConcurrentNodes(jobId: string, nodeIds: string[]): boolean {
    return this.frames.some((frame) => {
      if (frame.type !== 'progress_state' || frame.data.prompt_id !== jobId)
        return false
      const nodes = z
        .record(z.string(), z.object({ state: z.string() }))
        .safeParse(frame.data.nodes)
      return (
        nodes.success &&
        nodeIds.every((nodeId) => nodes.data[nodeId]?.state === 'running')
      )
    })
  }

  async job(jobId: string) {
    const response = await this.request.get(`${this.apiUrl}/api/jobs/${jobId}`)
    expect(response.ok()).toBeTruthy()
    const data: unknown = await response.json()
    const job = zJobDetail.parse(data)
    this.historyByJob[jobId] = job
    return job
  }

  async editRunInputs(comfyPage: ComfyPage) {
    const input = await comfyPage.nodeOps.getNodeRefById(1)
    await input.centerOnNode()
    const text = await input.getWidget(0)
    await text.click()
    await comfyPage.nodeOps.fillLegacyWidgetDialog('second-run')
    await expect.poll(() => text.getValue()).toBe('second-run')

    const sleep = await comfyPage.nodeOps.getNodeRefById(2)
    await sleep.centerOnNode()
    const seconds = await sleep.getWidget(0)
    const position = await seconds.getPosition()
    await comfyPage.page.mouse.dblclick(position.x, position.y)
    await comfyPage.nodeOps.fillLegacyWidgetDialog('10')
    await expect.poll(() => seconds.getValue()).toBe(10)
  }

  async cleanup() {
    for (const jobId of this.jobIds) {
      await this.request.post(`${this.apiUrl}/api/jobs/${jobId}/cancel`)
    }
  }
}
