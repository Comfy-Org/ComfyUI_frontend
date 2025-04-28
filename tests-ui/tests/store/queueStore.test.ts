import { describe, expect, it } from 'vitest'

import { TaskItemImpl } from '@/stores/queueStore'

describe('TaskItemImpl', () => {
  it('should remove animated property from outputs during construction', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
        'node-1': {
          images: [{ filename: 'test.png', type: 'output', subfolder: '' }],
          animated: [false]
        }
      }
    )

    // Check that animated property was removed
    expect('animated' in taskItem.outputs['node-1']).toBe(false)

    expect(taskItem.outputs['node-1'].images).toBeDefined()
    expect(taskItem.outputs['node-1'].images?.[0]?.filename).toBe('test.png')
  })

  it('should handle outputs without animated property', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
        'node-1': {
          images: [{ filename: 'test.png', type: 'output', subfolder: '' }]
        }
      }
    )

    expect(taskItem.outputs['node-1'].images).toBeDefined()
    expect(taskItem.outputs['node-1'].images?.[0]?.filename).toBe('test.png')
  })

  it('should recognize webm video from core', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
        'node-1': {
          video: [{ filename: 'test.webm', type: 'output', subfolder: '' }]
        }
      }
    )

    const output = taskItem.flatOutputs[0]

    expect(output.htmlVideoType).toBe('video/webm')
    expect(output.isVideo).toBe(true)
    expect(output.isWebm).toBe(true)
    expect(output.isVhsFormat).toBe(false)
    expect(output.isImage).toBe(false)
  })

  // https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite/blob/0a75c7958fe320efcb052f1d9f8451fd20c730a8/videohelpersuite/nodes.py#L578-L590
  it('should recognize webm video from VHS', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
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
      }
    )

    const output = taskItem.flatOutputs[0]

    expect(output.htmlVideoType).toBe('video/webm')
    expect(output.isVideo).toBe(true)
    expect(output.isWebm).toBe(true)
    expect(output.isVhsFormat).toBe(true)
    expect(output.isImage).toBe(false)
  })

  it('should recognize mp4 video from core', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, { client_id: 'client-id' }, []],
      { status_str: 'success', messages: [], completed: true },
      {
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
      }
    )

    const output = taskItem.flatOutputs[0]

    expect(output.htmlVideoType).toBe('video/mp4')
    expect(output.isVideo).toBe(true)
    expect(output.isImage).toBe(false)
  })
})
