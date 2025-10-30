import { extractFileFromDragEvent } from '@/utils/eventUtils'
import { describe, expect, it } from 'vitest'

function makeDragOptions(options: Partial<DragEventInit> = {}): DragEventInit {
  return {
    bubbles: true,
    cancelable: true,
    ...options
  }
}
describe('eventUtils', () => {
  describe('extractFileFromDragEvent', () => {
    it('should handle drops with no data', async () => {
      const actual = await extractFileFromDragEvent(new DragEvent('drop'))
      expect(actual).toBe(undefined)
    })

    it('should handle drops with dataTransfer but no files', async () => {
      const actual = await extractFileFromDragEvent(
        new DragEvent(
          'drop',
          makeDragOptions({ dataTransfer: new DataTransfer() })
        )
      )
      expect(actual).toBe(undefined)
    })

    it('should handle drops with no data', async () => {
      const actual = await extractFileFromDragEvent(new DragEvent('drop'))
      expect(actual).toBe(undefined)
    })
  })
})
