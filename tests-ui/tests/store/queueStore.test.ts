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
})
