import { describe, expect, it, vi } from 'vitest'

vi.mock(import('@/platform/assets/adapters/outputAssetMappers'), { spy: true })

import { extractWorkflow } from '@comfyorg/api-client/jobs/fetchJobs'
import { api } from '@/scripts/api'
import type { JobDetail, JobListItem } from '@comfyorg/api-client/jobs/jobTypes'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import {
  findActiveIndex,
  getJobAssets,
  getJobDetail,
  getJobApiPrompt,
  getJobWorkflow,
  getOutputsForTask
} from '@/platform/queue/services/jobOutputCache'
import { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'
import type { AugmentedResultItem } from '@comfyorg/api-client/results/resultItem'

vi.mock(import('@comfyorg/api-client/jobs/fetchJobs'), { spy: true })

vi.mock(import('@/scripts/api'))

function createResultItem(
  url: string,
  supportsPreview = true
): AugmentedResultItem {
  return {
    filename: url,
    subfolder: '',
    type: 'output',
    nodeId: 'node-1',
    mediaType: supportsPreview ? 'images' : 'unknown',
    url
  }
}

function createMockJob(id: string, outputsCount = 1): JobListItem {
  return {
    id,
    status: 'completed',
    create_time: Date.now(),
    preview_output: null,
    outputs_count: outputsCount,
    priority: 0
  }
}

function createTask(
  preview?: AugmentedResultItem,
  allOutputs?: AugmentedResultItem[],
  outputsCount = 1
): TaskItemImpl {
  const job = createMockJob(
    `task-${Math.random().toString(36).slice(2)}`,
    outputsCount
  )
  const flatOutputs = allOutputs ?? (preview ? [preview] : [])
  return new TaskItemImpl(job, {}, flatOutputs)
}

// Generate unique IDs per test to avoid cache collisions
let testCounter = 0
function uniqueId(prefix: string): string {
  return `${prefix}-${++testCounter}-${Date.now()}`
}

describe('jobOutputCache', () => {
  describe('findActiveIndex', () => {
    it('returns index of matching URL', () => {
      const items = [
        createResultItem('a'),
        createResultItem('b'),
        createResultItem('c')
      ]

      expect(findActiveIndex(items, 'b')).toBe(1)
    })

    it('returns 0 when URL not found', () => {
      const items = [createResultItem('a'), createResultItem('b')]

      expect(findActiveIndex(items, 'missing')).toBe(0)
    })

    it('returns 0 when URL is undefined', () => {
      const items = [createResultItem('a'), createResultItem('b')]

      expect(findActiveIndex(items, undefined)).toBe(0)
    })
  })

  describe('getOutputsForTask', () => {
    it('returns previewable outputs directly when no lazy load needed', async () => {
      const outputs = [createResultItem('p-1'), createResultItem('p-2')]
      const task = createTask(undefined, outputs, 1)

      const result = await getOutputsForTask(task)

      expect(result).toEqual(outputs)
    })

    it('lazy loads when outputsCount > 1', async () => {
      const previewOutput = createResultItem('preview')
      const fullOutputs = [
        createResultItem('full-1'),
        createResultItem('full-2')
      ]

      const job = createMockJob(uniqueId('task'), 3)
      const task = new TaskItemImpl(job, {}, [previewOutput])
      vi.mocked(api.getJobDetail).mockResolvedValue({
        ...job,
        outputs: { 'node-1': { images: fullOutputs } }
      })

      const result = await getOutputsForTask(task)

      expect(result).toEqual(fullOutputs)
      expect(api.getJobDetail).toHaveBeenCalledWith(job.id)
    })

    it('returns preview outputs without fetching details for a running job', async () => {
      const previewOutput = createResultItem('preview')
      const job: JobListItem = {
        ...createMockJob(uniqueId('task'), 3),
        status: 'in_progress'
      }
      const task = new TaskItemImpl(job, {}, [previewOutput])

      expect(await getOutputsForTask(task)).toEqual([previewOutput])
      expect(api.getJobDetail).not.toHaveBeenCalled()
    })

    it('caches loaded tasks', async () => {
      const fullOutputs = [createResultItem('full-1')]

      const job = createMockJob(uniqueId('task'), 3)
      const task = new TaskItemImpl(job, {}, [createResultItem('preview')])
      vi.mocked(api.getJobDetail).mockResolvedValue({
        ...job,
        outputs: { 'node-1': { images: fullOutputs } }
      })

      expect(await getOutputsForTask(task)).toEqual(fullOutputs)
      expect(api.getJobDetail).toHaveBeenCalledTimes(1)

      expect(await getOutputsForTask(task)).toEqual(fullOutputs)
      expect(api.getJobDetail).toHaveBeenCalledTimes(1)
    })

    it('falls back to preview outputs on load error', async () => {
      const previewOutput = createResultItem('preview')

      const job = createMockJob(uniqueId('task'), 3)
      const task = new TaskItemImpl(job, {}, [previewOutput])
      vi.mocked(api.getJobDetail).mockRejectedValue(new Error('Network error'))

      const result = await getOutputsForTask(task)

      expect(result).toEqual([previewOutput])
    })

    it.for([undefined, { outputs: undefined }, { outputs: {} }])(
      'retries missing outputs on the next selection: %j',
      async (detail) => {
        const preview = createResultItem('preview')
        const job = createMockJob(uniqueId('missing-outputs'), 3)
        const task = new TaskItemImpl(job, {}, [preview])
        const outputs = [createResultItem('full-1'), createResultItem('full-2')]
        vi.mocked(api.getJobDetail)
          .mockResolvedValueOnce(detail ? { ...job, ...detail } : undefined)
          .mockResolvedValueOnce({
            ...job,
            outputs: { 'node-1': { images: outputs } }
          })

        expect(await getOutputsForTask(task)).toEqual([preview])
        expect(await getOutputsForTask(task)).toEqual(outputs)
      }
    )

    it('retries missing outputs even when the failed selection was superseded', async () => {
      const job = createMockJob(uniqueId('superseded-missing'), 2)
      const task = new TaskItemImpl(job, {}, [createResultItem('preview')])
      const outputs = [createResultItem('full-1'), createResultItem('full-2')]
      vi.mocked(api.getJobDetail)
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce({
          ...job,
          outputs: { 'node-1': { images: outputs } }
        })

      const firstSelection = getOutputsForTask(task)
      await getOutputsForTask(createTask(createResultItem('other-preview')))

      expect(await firstSelection).toBeNull()
      expect(await getOutputsForTask(task)).toEqual(outputs)
    })

    it('shares a pending detail request with other output and detail readers', async () => {
      const job = createMockJob(uniqueId('shared-outputs'), 2)
      const task = new TaskItemImpl(job, {}, [createResultItem('preview')])
      const outputs = [createResultItem('full-1'), createResultItem('full-2')]
      let resolveDetail!: (detail: JobDetail) => void
      const pendingDetail = new Promise<JobDetail>((resolve) => {
        resolveDetail = resolve
      })
      vi.mocked(api.getJobDetail).mockReturnValue(pendingDetail)

      const first = getOutputsForTask(task)
      const second = getOutputsForTask(task)
      const detail = getJobDetail(job.id)
      resolveDetail({ ...job, outputs: { 'node-1': { images: outputs } } })

      expect(await Promise.all([first, second])).toEqual([outputs, outputs])
      expect((await detail)?.outputs).toEqual({
        'node-1': { images: outputs }
      })
      expect(api.getJobDetail).toHaveBeenCalledTimes(1)
    })

    it('returns null when request is superseded', async () => {
      const job1 = createMockJob(uniqueId('task'), 3)
      const job2 = createMockJob(uniqueId('task'), 3)

      const task1 = new TaskItemImpl(job1, {}, [createResultItem('preview-1')])
      const task2 = new TaskItemImpl(job2, {}, [createResultItem('preview-2')])

      let resolveFirst!: (detail: JobDetail) => void
      const firstDetail = new Promise<JobDetail>((resolve) => {
        resolveFirst = resolve
      })
      vi.mocked(api.getJobDetail)
        .mockReturnValueOnce(firstDetail)
        .mockResolvedValueOnce({
          ...job2,
          outputs: { 'node-1': { images: [createResultItem('full-2')] } }
        })

      const promise1 = getOutputsForTask(task1)
      const result2 = await getOutputsForTask(task2)
      resolveFirst({
        ...job1,
        outputs: { 'node-1': { images: [createResultItem('full-1')] } }
      })
      const result1 = await promise1

      expect(result1).toBeNull()
      expect(result2).toEqual([createResultItem('full-2')])
    })
  })

  describe('getPreviewableOutputsFromJobDetail', () => {
    it('returns empty array when job detail or outputs are missing', async () => {
      const { getPreviewableOutputsFromJobDetail } =
        await import('@/platform/queue/services/jobOutputCache')

      expect(getPreviewableOutputsFromJobDetail(undefined)).toEqual([])

      const jobDetail: JobDetail = {
        id: 'job-empty',
        status: 'completed',
        create_time: Date.now(),
        priority: 0
      }

      expect(getPreviewableOutputsFromJobDetail(jobDetail)).toEqual([])
    })

    it('maps previewable outputs and skips animated/text entries', async () => {
      const { getPreviewableOutputsFromJobDetail } =
        await import('@/platform/queue/services/jobOutputCache')
      const jobDetail: JobDetail = {
        id: 'job-previewable',
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {
          'node-1': {
            images: [
              { filename: 'image.png', subfolder: '', type: 'output' },
              { filename: 'image.webp', subfolder: '', type: 'temp' }
            ],
            animated: [true],
            text: 'hello'
          },
          'node-2': {
            video: [{ filename: 'clip.mp4', subfolder: '', type: 'output' }],
            audio: [{ filename: 'sound.mp3', subfolder: '', type: 'output' }]
          }
        }
      }

      const result = getPreviewableOutputsFromJobDetail(jobDetail)

      expect(result).toHaveLength(4)
      expect(result.map((item) => item.filename).sort()).toEqual(
        expect.arrayContaining([
          'image.png',
          'image.webp',
          'clip.mp4',
          'sound.mp3'
        ])
      )

      const image = result.find((item) => item.filename === 'image.png')
      const video = result.find((item) => item.filename === 'clip.mp4')

      expect(image?.nodeId).toBe('node-1')
      expect(image?.mediaType).toBe('images')
      expect(video?.nodeId).toBe('node-2')
      expect(video?.mediaType).toBe('video')
    })

    it('preserves display_name from output items', async () => {
      const { getPreviewableOutputsFromJobDetail } =
        await import('@/platform/queue/services/jobOutputCache')
      const jobDetail: JobDetail = {
        id: 'job-display-name',
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {
          'node-1': {
            images: [
              {
                filename: 'abc123hash.png',
                subfolder: '',
                type: 'output',
                display_name: 'ComfyUI_00001_.png'
              }
            ]
          }
        }
      }

      const result = getPreviewableOutputsFromJobDetail(jobDetail)

      expect(result).toHaveLength(1)
      expect(result[0].filename).toBe('abc123hash.png')
      expect(result[0].display_name).toBe('ComfyUI_00001_.png')
    })

    it('returns previewable image and text outputs', async () => {
      const { getPreviewableOutputsFromJobDetail } =
        await import('@/platform/queue/services/jobOutputCache')
      const jobDetail: JobDetail = {
        id: 'job-filter',
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {
          'node-3': {
            images: [{ filename: 'valid.png', subfolder: '', type: 'output' }],
            text: ['not-object'],
            unknown: [{ filename: 'data.bin', subfolder: '', type: 'output' }]
          }
        }
      }

      const result = getPreviewableOutputsFromJobDetail(jobDetail)

      expect(result).toEqual([
        expect.objectContaining({
          filename: 'valid.png',
          mediaType: 'images'
        }),
        expect.objectContaining({
          content: 'not-object',
          mediaType: 'text'
        })
      ])
    })
  })

  describe('getJobDetail', () => {
    it('fetches and caches job detail', async () => {
      const jobId = uniqueId('job')

      const mockDetail: JobDetail = {
        id: jobId,
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {}
      }
      vi.mocked(api.getJobDetail).mockResolvedValue(mockDetail)

      const result = await getJobDetail(jobId)

      expect(result).toEqual(mockDetail)
      expect(api.getJobDetail).toHaveBeenCalledWith(jobId)
    })

    it('returns cached job detail on subsequent calls', async () => {
      const jobId = uniqueId('job')

      const mockDetail: JobDetail = {
        id: jobId,
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {}
      }
      vi.mocked(api.getJobDetail).mockResolvedValue(mockDetail)

      // First call
      await getJobDetail(jobId)
      expect(api.getJobDetail).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const result = await getJobDetail(jobId)
      expect(result).toEqual(mockDetail)
      expect(api.getJobDetail).toHaveBeenCalledTimes(1)
    })

    it('returns undefined on fetch error', async () => {
      const jobId = uniqueId('job-error')

      vi.mocked(api.getJobDetail).mockRejectedValue(new Error('Network error'))

      const result = await getJobDetail(jobId)

      expect(result).toBeUndefined()
    })

    it('shares pending detail requests and retries after a failure', async () => {
      const jobId = uniqueId('pending-detail')
      const detail: JobDetail = {
        id: jobId,
        status: 'completed',
        create_time: 123,
        priority: 0,
        outputs: {}
      }
      vi.mocked(api.getJobDetail)
        .mockRejectedValueOnce(new Error('Offline'))
        .mockResolvedValueOnce(detail)

      expect(
        await Promise.all([getJobDetail(jobId), getJobDetail(jobId)])
      ).toEqual([undefined, undefined])
      expect(await getJobDetail(jobId)).toEqual(detail)
      expect(api.getJobDetail).toHaveBeenCalledTimes(2)
    })
  })

  describe('getJobAssets', () => {
    it('caches assets after the first fetch', async () => {
      const jobId = uniqueId('job-assets')
      vi.mocked(api.getJobAssets).mockResolvedValue({
        assets: [{ id: 'a1', name: 'a.png', created_at: 't' }],
        complete: true
      })

      await getJobAssets(jobId)
      const result = await getJobAssets(jobId)

      expect(result.map((asset) => asset.id)).toEqual(['a1'])
      expect(api.getJobAssets).toHaveBeenCalledTimes(1)
    })

    it('dedupes concurrent requests for the same job', async () => {
      const jobId = uniqueId('job-assets')
      vi.mocked(api.getJobAssets).mockResolvedValue({
        assets: [{ id: 'a1', name: 'a.png', created_at: 't' }],
        complete: true
      })

      const [first, second] = await Promise.all([
        getJobAssets(jobId),
        getJobAssets(jobId)
      ])

      expect(first).toEqual(second)
      expect(api.getJobAssets).toHaveBeenCalledTimes(1)
    })

    it('does not cache empty results', async () => {
      const jobId = uniqueId('job-assets')
      vi.mocked(api.getJobAssets).mockResolvedValue({
        assets: [],
        complete: true
      })

      await getJobAssets(jobId)
      await getJobAssets(jobId)

      expect(api.getJobAssets).toHaveBeenCalledTimes(2)
    })

    it('does not cache a truncated result, and re-fetches once complete', async () => {
      const jobId = uniqueId('job-assets')
      vi.mocked(api.getJobAssets).mockResolvedValue({
        assets: [{ id: 'a1', name: 'a.png', created_at: 't' }],
        complete: false
      })

      const truncated = await getJobAssets(jobId)
      expect(truncated.map((asset) => asset.id)).toEqual(['a1'])

      vi.mocked(api.getJobAssets).mockResolvedValue({
        assets: [
          { id: 'a1', name: 'a.png', created_at: 't' },
          { id: 'a2', name: 'b.png', created_at: 't' }
        ],
        complete: true
      })

      const recovered = await getJobAssets(jobId)

      expect(recovered.map((asset) => asset.id)).toEqual(['a1', 'a2'])
      expect(api.getJobAssets).toHaveBeenCalledTimes(2)
    })
  })

  describe('getJobWorkflow', () => {
    it('fetches job detail and extracts workflow', async () => {
      const jobId = uniqueId('job-wf')

      const mockDetail: JobDetail = {
        id: jobId,
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {}
      }
      const mockWorkflow = { version: 1 } as Partial<ComfyWorkflowJSON>

      vi.mocked(api.getJobDetail).mockResolvedValue(mockDetail)
      vi.mocked(extractWorkflow).mockResolvedValue(
        mockWorkflow as ComfyWorkflowJSON
      )

      const result = await getJobWorkflow(jobId)

      expect(result).toEqual(mockWorkflow)
      expect(extractWorkflow).toHaveBeenCalledWith(mockDetail)
    })

    it('returns undefined when job detail not found', async () => {
      const jobId = uniqueId('missing')

      vi.mocked(api.getJobDetail).mockResolvedValue(undefined)
      vi.mocked(extractWorkflow).mockResolvedValue(undefined)

      const result = await getJobWorkflow(jobId)

      expect(result).toBeUndefined()
    })
  })

  describe('getJobApiPrompt', () => {
    const apiPrompt = { '1': { class_type: 'KSampler', inputs: {} } }

    function jobWithWorkflow(jobId: string, workflow: unknown): JobDetail {
      return {
        id: jobId,
        status: 'completed',
        create_time: Date.now(),
        priority: 0,
        outputs: {},
        workflow
      }
    }

    it('returns the stored API prompt for an API-submitted job', async () => {
      const jobId = uniqueId('job-api')
      vi.mocked(api.getJobDetail).mockResolvedValue(
        jobWithWorkflow(jobId, { prompt: apiPrompt })
      )

      await expect(getJobApiPrompt(jobId)).resolves.toEqual(apiPrompt)
    })

    it('returns the stored API prompt when extra_data is null', async () => {
      const jobId = uniqueId('job-api-null')
      vi.mocked(api.getJobDetail).mockResolvedValue(
        jobWithWorkflow(jobId, { prompt: apiPrompt, extra_data: null })
      )

      await expect(getJobApiPrompt(jobId)).resolves.toEqual(apiPrompt)
    })

    it('returns undefined when the job embeds an editor workflow', async () => {
      const jobId = uniqueId('job-embedded')
      vi.mocked(api.getJobDetail).mockResolvedValue(
        jobWithWorkflow(jobId, {
          prompt: apiPrompt,
          extra_data: { extra_pnginfo: { workflow: { nodes: [] } } }
        })
      )

      await expect(getJobApiPrompt(jobId)).resolves.toBeUndefined()
    })

    it('returns undefined when job detail not found', async () => {
      const jobId = uniqueId('job-api-missing')
      vi.mocked(api.getJobDetail).mockResolvedValue(undefined)

      await expect(getJobApiPrompt(jobId)).resolves.toBeUndefined()
    })
  })
})
