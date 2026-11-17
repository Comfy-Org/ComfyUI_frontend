import { describe, expect, it } from 'vitest'
import type { JobListItem } from './jobTypes'
import { TaskItemImpl } from './taskItem'
import {
  isAudioResult,
  isImageResult,
  isTextResult,
  isVhsFormat,
  isVideoResult,
  resultItemHtmlAudioType,
  resultItemHtmlVideoType,
  resultItemSupportsPreview
} from '@comfyorg/api-client/results/resultItem'
function createJob(
  id: string,
  status: JobListItem['status'],
  createTime: number = Date.now(),
  priority?: number
): JobListItem {
  return {
    id,
    status,
    create_time: createTime,
    update_time: createTime,
    last_state_update: createTime,
    priority: priority ?? createTime
  }
}
function createHistoryJob(createTime: number, id: string): JobListItem {
  return createJob(id, 'completed', createTime)
}
describe('TaskItemImpl', () => {
  it('should exclude animated from flatOutputs', () => {
    const job = createHistoryJob(0, 'job-id')
    const taskItem = new TaskItemImpl(job, {
      'node-1': {
        images: [{ filename: 'test.png', type: 'output', subfolder: '' }],
        animated: [false]
      }
    })
    expect(taskItem.flatOutputs).toHaveLength(1)
    expect(taskItem.flatOutputs[0].filename).toBe('test.png')
    expect(taskItem.flatOutputs[0].mediaType).toBe('images')
  })
  it('should handle outputs without animated property', () => {
    const job = createHistoryJob(0, 'job-id')
    const taskItem = new TaskItemImpl(job, {
      'node-1': {
        images: [{ filename: 'test.png', type: 'output', subfolder: '' }]
      }
    })
    expect(taskItem.outputs['node-1'].images).toBeDefined()
    expect(taskItem.outputs['node-1'].images?.[0]?.filename).toBe('test.png')
  })
  it('should recognize webm video from core', () => {
    const job = createHistoryJob(0, 'job-id')
    const taskItem = new TaskItemImpl(job, {
      'node-1': {
        video: [{ filename: 'test.webm', type: 'output', subfolder: '' }]
      }
    })
    const output = taskItem.flatOutputs[0]
    expect(resultItemHtmlVideoType(output)).toBe('video/webm')
    expect(isVideoResult(output)).toBe(true)
    expect(isVhsFormat(output)).toBe(false)
    expect(isImageResult(output)).toBe(false)
  })
  it('should recognize webm video from VHS', () => {
    const job = createHistoryJob(0, 'job-id')
    const taskItem = new TaskItemImpl(job, {
      'node-1': {
        gifs: [
          {
            filename: 'test.webm',
            type: 'output',
            subfolder: '',
            format: 'video/webm',
            frame_rate: 30
          }
        ]
      }
    })
    const output = taskItem.flatOutputs[0]
    expect(resultItemHtmlVideoType(output)).toBe('video/webm')
    expect(isVideoResult(output)).toBe(true)
    expect(isVhsFormat(output)).toBe(true)
    expect(isImageResult(output)).toBe(false)
  })
  it('should recognize mp4 video from core', () => {
    const job = createHistoryJob(0, 'job-id')
    const taskItem = new TaskItemImpl(job, {
      'node-1': {
        images: [
          {
            filename: 'test.mp4',
            type: 'output',
            subfolder: ''
          }
        ],
        animated: [true]
      }
    })
    const output = taskItem.flatOutputs[0]
    expect(resultItemHtmlVideoType(output)).toBe('video/mp4')
    expect(isVideoResult(output)).toBe(true)
    expect(isImageResult(output)).toBe(false)
  })
  describe('audio format detection', () => {
    const audioFormats = [
      { extension: 'mp3', mimeType: 'audio/mpeg' },
      { extension: 'wav', mimeType: 'audio/wav' },
      { extension: 'ogg', mimeType: 'audio/ogg' },
      { extension: 'flac', mimeType: 'audio/flac' }
    ]
    audioFormats.forEach(({ extension, mimeType }) => {
      it(`should recognize ${extension} audio`, () => {
        const job = createHistoryJob(0, 'job-id')
        const taskItem = new TaskItemImpl(job, {
          'node-1': {
            audio: [
              {
                filename: `test.${extension}`,
                type: 'output',
                subfolder: ''
              }
            ]
          }
        })
        const output = taskItem.flatOutputs[0]
        expect(resultItemHtmlAudioType(output)).toBe(mimeType)
        expect(isAudioResult(output)).toBe(true)
        expect(isVideoResult(output)).toBe(false)
        expect(isImageResult(output)).toBe(false)
        expect(resultItemSupportsPreview(output)).toBe(true)
      })
    })
  })
  it('should recognize text files saved under the files output key', () => {
    const job = createHistoryJob(0, 'job-id')
    const taskItem = new TaskItemImpl(job, {
      'node-1': {
        files: [
          {
            filename: 'result.txt',
            type: 'output',
            subfolder: ''
          }
        ]
      }
    })
    const output = taskItem.flatOutputs[0]
    expect(isTextResult(output)).toBe(true)
    expect(isImageResult(output)).toBe(false)
    expect(isVideoResult(output)).toBe(false)
    expect(isAudioResult(output)).toBe(false)
    expect(resultItemSupportsPreview(output)).toBe(true)
  })
  it('should parse text outputs', () => {
    const job: JobListItem = {
      ...createHistoryJob(0, 'text-job'),
      preview_output: {
        nodeId: '5',
        mediaType: 'text',
        content: 'test'
      } satisfies JobListItem['preview_output']
    }
    const task = new TaskItemImpl(job)
    expect(task.flatOutputs).toStrictEqual([
      expect.objectContaining({
        filename: '',
        content: 'test',
        mediaType: 'text'
      })
    ])
    expect(task.previewableOutputs).toStrictEqual(task.flatOutputs)
  })
  it('should reject non-text preview outputs without a filename', () => {
    const job: JobListItem = {
      ...createHistoryJob(0, 'image-job'),
      preview_output: {
        nodeId: '5',
        mediaType: 'images'
      } satisfies JobListItem['preview_output']
    }
    const task = new TaskItemImpl(job)
    expect(task.flatOutputs).toHaveLength(0)
  })
  it('rejects text previews without a filename or content', () => {
    const task = new TaskItemImpl({
      ...createHistoryJob(0, 'empty-text-job'),
      preview_output: { nodeId: '5', mediaType: 'text' }
    })

    expect(task.previewableOutputs).toEqual([])
    expect(task.previewOutput).toBeUndefined()
  })
  describe('error extraction getters', () => {
    it('errorMessage returns undefined when no execution_error', () => {
      const job = createHistoryJob(0, 'job-id')
      const taskItem = new TaskItemImpl(job)
      expect(taskItem.errorMessage).toBeUndefined()
    })
    it('errorMessage returns the exception_message from execution_error', () => {
      const job: JobListItem = {
        ...createHistoryJob(0, 'job-id'),
        status: 'failed',
        execution_error: {
          node_id: 'node-1',
          node_type: 'KSampler',
          exception_message: 'GPU out of memory',
          exception_type: 'RuntimeError',
          traceback: ['line 1', 'line 2'],
          current_inputs: {},
          current_outputs: {}
        }
      }
      const taskItem = new TaskItemImpl(job)
      expect(taskItem.errorMessage).toBe('GPU out of memory')
    })
    it('executionError returns undefined when no execution_error', () => {
      const job = createHistoryJob(0, 'job-id')
      const taskItem = new TaskItemImpl(job)
      expect(taskItem.executionError).toBeUndefined()
    })
    it('executionError returns the full error object from execution_error', () => {
      const errorDetail = {
        node_id: 'node-1',
        node_type: 'KSampler',
        executed: ['node-0'],
        exception_message: 'Invalid dimensions',
        exception_type: 'ValueError',
        traceback: ['traceback line'],
        current_inputs: { input1: 'value' },
        current_outputs: {}
      }
      const job: JobListItem = {
        ...createHistoryJob(0, 'job-id'),
        status: 'failed',
        execution_error: errorDetail
      }
      const taskItem = new TaskItemImpl(job)
      expect(taskItem.executionError).toEqual(errorDetail)
    })
  })
  describe('previewableOutputsCount', () => {
    it('returns undefined when the job has no previewable_outputs_count', () => {
      const job = createHistoryJob(0, 'job-id')
      const taskItem = new TaskItemImpl(job)
      expect(taskItem.previewableOutputsCount).toBeUndefined()
    })
    it('returns the server-provided previewable_outputs_count', () => {
      const job: JobListItem = {
        ...createHistoryJob(0, 'job-id'),
        previewable_outputs_count: 2
      }
      const taskItem = new TaskItemImpl(job)
      expect(taskItem.previewableOutputsCount).toBe(2)
    })
    it('returns 0 when previewable_outputs_count is 0', () => {
      const job: JobListItem = {
        ...createHistoryJob(0, 'job-id'),
        previewable_outputs_count: 0
      }
      const taskItem = new TaskItemImpl(job)
      expect(taskItem.previewableOutputsCount).toBe(0)
    })
    it('normalizes an explicit null previewable_outputs_count to undefined', () => {
      const job: JobListItem = {
        ...createHistoryJob(0, 'job-id'),
        previewable_outputs_count: null
      }
      const taskItem = new TaskItemImpl(job)
      expect(taskItem.previewableOutputsCount).toBeUndefined()
    })
  })
})
