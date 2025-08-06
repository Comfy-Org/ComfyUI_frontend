import { describe, expect, it } from 'vitest'

import { TaskItemImpl } from '@/stores/queueStore'

describe('TaskItemImpl', () => {
  describe('prompt property accessors', () => {
    it('should correctly access queueIndex from priority', () => {
      const taskItem = new TaskItemImpl('Pending', {
        priority: 5,
        prompt_id: 'test-id',
        extra_data: { client_id: 'client-id' }
      })

      expect(taskItem.queueIndex).toBe(5)
    })

    it('should correctly access promptId from prompt_id', () => {
      const taskItem = new TaskItemImpl('History', {
        priority: 0,
        prompt_id: 'unique-prompt-id',
        extra_data: { client_id: 'client-id' }
      })

      expect(taskItem.promptId).toBe('unique-prompt-id')
    })

    it('should correctly access extraData', () => {
      const extraData = {
        client_id: 'client-id',
        extra_pnginfo: {
          workflow: {
            last_node_id: 1,
            last_link_id: 0,
            nodes: [],
            links: [],
            groups: [],
            config: {},
            extra: {},
            version: 0.4
          }
        }
      }
      const taskItem = new TaskItemImpl('Running', {
        priority: 1,
        prompt_id: 'test-id',
        extra_data: extraData
      })

      expect(taskItem.extraData).toEqual(extraData)
    })

    it('should correctly access workflow from extraPngInfo', () => {
      const workflow = {
        last_node_id: 1,
        last_link_id: 0,
        nodes: [],
        links: [],
        groups: [],
        config: {},
        extra: {},
        version: 0.4
      }
      const taskItem = new TaskItemImpl('History', {
        priority: 0,
        prompt_id: 'test-id',
        extra_data: {
          client_id: 'client-id',
          extra_pnginfo: { workflow }
        }
      })

      expect(taskItem.workflow).toEqual(workflow)
    })

    it('should return undefined workflow when extraPngInfo is missing', () => {
      const taskItem = new TaskItemImpl('History', {
        priority: 0,
        prompt_id: 'test-id',
        extra_data: { client_id: 'client-id' }
      })

      expect(taskItem.workflow).toBeUndefined()
    })
  })

  it('should remove animated property from outputs during construction', () => {
    const taskItem = new TaskItemImpl(
      'History',
      {
        priority: 0,
        prompt_id: 'prompt-id',
        extra_data: { client_id: 'client-id' }
      },
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
      {
        priority: 0,
        prompt_id: 'prompt-id',
        extra_data: { client_id: 'client-id' }
      },
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
      {
        priority: 0,
        prompt_id: 'prompt-id',
        extra_data: { client_id: 'client-id' }
      },
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
      {
        priority: 0,
        prompt_id: 'prompt-id',
        extra_data: { client_id: 'client-id' }
      },
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
      {
        priority: 0,
        prompt_id: 'prompt-id',
        extra_data: { client_id: 'client-id' }
      },
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

  describe('audio format detection', () => {
    const audioFormats = [
      { extension: 'mp3', mimeType: 'audio/mpeg' },
      { extension: 'wav', mimeType: 'audio/wav' },
      { extension: 'ogg', mimeType: 'audio/ogg' },
      { extension: 'flac', mimeType: 'audio/flac' }
    ]

    audioFormats.forEach(({ extension, mimeType }) => {
      it(`should recognize ${extension} audio`, () => {
        const taskItem = new TaskItemImpl(
          'History',
          {
            priority: 0,
            prompt_id: 'prompt-id',
            extra_data: { client_id: 'client-id' }
          },
          { status_str: 'success', messages: [], completed: true },
          {
            'node-1': {
              audio: [
                {
                  filename: `test.${extension}`,
                  type: 'output',
                  subfolder: ''
                }
              ]
            }
          }
        )

        const output = taskItem.flatOutputs[0]

        expect(output.htmlAudioType).toBe(mimeType)
        expect(output.isAudio).toBe(true)
        expect(output.isVideo).toBe(false)
        expect(output.isImage).toBe(false)
        expect(output.supportsPreview).toBe(true)
      })
    })
  })

  describe('execution timestamp properties', () => {
    it('should extract execution start timestamp from messages', () => {
      const taskItem = new TaskItemImpl(
        'History',
        {
          priority: 0,
          prompt_id: 'test-id',
          extra_data: { client_id: 'client-id' }
        },
        {
          status_str: 'success',
          completed: true,
          messages: [
            [
              'execution_start',
              { prompt_id: 'test-id', timestamp: 1234567890 }
            ],
            [
              'execution_success',
              { prompt_id: 'test-id', timestamp: 1234567900 }
            ]
          ]
        }
      )

      expect(taskItem.executionStartTimestamp).toBe(1234567890)
    })

    it('should return undefined when no execution_start message exists', () => {
      const taskItem = new TaskItemImpl(
        'History',
        {
          priority: 0,
          prompt_id: 'test-id',
          extra_data: { client_id: 'client-id' }
        },
        {
          status_str: 'success',
          completed: true,
          messages: [
            [
              'execution_success',
              { prompt_id: 'test-id', timestamp: 1234567900 }
            ]
          ]
        }
      )

      expect(taskItem.executionStartTimestamp).toBeUndefined()
    })

    it('should return undefined when status has no messages', () => {
      const taskItem = new TaskItemImpl(
        'History',
        {
          priority: 0,
          prompt_id: 'test-id',
          extra_data: { client_id: 'client-id' }
        },
        {
          status_str: 'success',
          completed: true,
          messages: []
        }
      )

      expect(taskItem.executionStartTimestamp).toBeUndefined()
    })

    it('should return undefined when status is undefined', () => {
      const taskItem = new TaskItemImpl('History', {
        priority: 0,
        prompt_id: 'test-id',
        extra_data: { client_id: 'client-id' }
      })

      expect(taskItem.executionStartTimestamp).toBeUndefined()
    })
  })

  describe('sorting by execution start time', () => {
    it('should sort history tasks by execution start timestamp descending', () => {
      const task1 = new TaskItemImpl(
        'History',
        {
          priority: 1,
          prompt_id: 'old-task',
          extra_data: { client_id: 'client-id' }
        },
        {
          status_str: 'success',
          completed: true,
          messages: [
            ['execution_start', { prompt_id: 'old-task', timestamp: 1000 }]
          ]
        }
      )

      const task2 = new TaskItemImpl(
        'History',
        {
          priority: 2,
          prompt_id: 'new-task',
          extra_data: { client_id: 'client-id' }
        },
        {
          status_str: 'success',
          completed: true,
          messages: [
            ['execution_start', { prompt_id: 'new-task', timestamp: 3000 }]
          ]
        }
      )

      const task3 = new TaskItemImpl(
        'History',
        {
          priority: 3,
          prompt_id: 'middle-task',
          extra_data: { client_id: 'client-id' }
        },
        {
          status_str: 'success',
          completed: true,
          messages: [
            ['execution_start', { prompt_id: 'middle-task', timestamp: 2000 }]
          ]
        }
      )

      const tasks = [task1, task2, task3]

      // Sort using the same logic as queueStore
      tasks.sort((a, b) => {
        const aTime = a.executionStartTimestamp ?? 0
        const bTime = b.executionStartTimestamp ?? 0
        return bTime - aTime
      })

      expect(tasks[0].promptId).toBe('new-task')
      expect(tasks[1].promptId).toBe('middle-task')
      expect(tasks[2].promptId).toBe('old-task')
    })

    it('should place tasks without execution start timestamp at end', () => {
      const taskWithTime = new TaskItemImpl(
        'History',
        {
          priority: 1,
          prompt_id: 'with-time',
          extra_data: { client_id: 'client-id' }
        },
        {
          status_str: 'success',
          completed: true,
          messages: [
            ['execution_start', { prompt_id: 'with-time', timestamp: 2000 }]
          ]
        }
      )

      const taskWithoutTime = new TaskItemImpl(
        'History',
        {
          priority: 2,
          prompt_id: 'without-time',
          extra_data: { client_id: 'client-id' }
        },
        {
          status_str: 'success',
          completed: true,
          messages: []
        }
      )

      const tasks = [taskWithoutTime, taskWithTime]

      // Sort using the same logic as queueStore
      tasks.sort((a, b) => {
        const aTime = a.executionStartTimestamp ?? 0
        const bTime = b.executionStartTimestamp ?? 0
        return bTime - aTime
      })

      expect(tasks[0].promptId).toBe('with-time')
      expect(tasks[1].promptId).toBe('without-time')
    })
  })
})
