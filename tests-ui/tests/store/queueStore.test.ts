// @ts-strict-ignore
import { TaskItemImpl } from '@/stores/queueStore'

describe('TaskItemImpl', () => {
  it('should remove animated property from outputs during construction', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, {}, []],
      { status_str: 'success', messages: [] },
      {
        'node-1': {
          images: [{ filename: 'test.png', type: 'output', subfolder: '' }],
          animated: [false]
        }
      }
    )

    // Check that animated property was removed
    expect('animated' in taskItem.outputs['node-1']).toBe(false)

    // Verify other output properties remain intact
    expect(taskItem.outputs['node-1'].images).toBeDefined()
    expect(taskItem.outputs['node-1'].images[0].filename).toBe('test.png')
  })

  it('should handle outputs without animated property', () => {
    const taskItem = new TaskItemImpl(
      'History',
      [0, 'prompt-id', {}, {}, []],
      { status_str: 'success', messages: [] },
      {
        'node-1': {
          images: [{ filename: 'test.png', type: 'output', subfolder: '' }]
        }
      }
    )

    // Verify outputs are preserved when no animated property exists
    expect(taskItem.outputs['node-1'].images).toBeDefined()
    expect(taskItem.outputs['node-1'].images[0].filename).toBe('test.png')
  })
})
