import { extractFileFromDragEvent } from '@/utils/eventUtils'
import { describe, expect, it } from 'vitest'

describe('eventUtils', () => {
  describe('extractFileFromDragEvent', () => {
    it('should handle drops with no data', async () => {
      const actual = await extractFileFromDragEvent(new FakeDragEvent('drop'))
      expect(actual).toBe(undefined)
    })

    it('should handle drops with dataTransfer but no files', async () => {
      const actual = await extractFileFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer: new DataTransfer() })
      )
      expect(actual).toBe(undefined)
    })

    it('should handle drops with dataTransfer with files', async () => {
      const fileWithWorkflowMaybeWhoKnows = new File(
        [new Uint8Array()],
        'fake_workflow.json',
        {
          type: 'application/json'
        }
      )

      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(fileWithWorkflowMaybeWhoKnows)

      const event = new FakeDragEvent('drop', { dataTransfer })

      const actual = await extractFileFromDragEvent(event)
      expect(actual).toBe(fileWithWorkflowMaybeWhoKnows)
    })

    it('should handle drops with multiple image files', async () => {
      const imageFile1 = new File([new Uint8Array()], 'image1.png', {
        type: 'image/png'
      })
      const imageFile2 = new File([new Uint8Array()], 'image2.jpg', {
        type: 'image/jpeg'
      })

      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(imageFile1)
      dataTransfer.items.add(imageFile2)

      const event = new FakeDragEvent('drop', { dataTransfer })

      const actual = await extractFileFromDragEvent(event)
      expect(actual).toBeDefined()
      expect((actual as FileList).length).toBe(2)
      expect((actual as FileList)[0]).toBe(imageFile1)
      expect((actual as FileList)[1]).toBe(imageFile2)
    })

    it('should return undefined when dropping multiple non-image files', async () => {
      const file1 = new File([new Uint8Array()], 'file1.txt', {
        type: 'text/plain'
      })
      const file2 = new File([new Uint8Array()], 'file2.txt', {
        type: 'text/plain'
      })

      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file1)
      dataTransfer.items.add(file2)

      const event = new FakeDragEvent('drop', { dataTransfer })

      const actual = await extractFileFromDragEvent(event)
      expect(actual).toBe(undefined)
    })

    // Skip until we can setup MSW
    it.skip('should handle drops with URLs', async () => {
      const urlWithWorkflow = 'https://fakewebsite.notreal/fake_workflow.json'

      const dataTransfer = new DataTransfer()

      dataTransfer.setData('text/uri-list', urlWithWorkflow)
      dataTransfer.setData('text/x-moz-url', urlWithWorkflow)

      const event = new FakeDragEvent('drop', { dataTransfer })

      const actual = await extractFileFromDragEvent(event)
      expect(actual).toBeInstanceOf(File)
    })
  })
})

// Needed to keep the dataTransfer defined
class FakeDragEvent extends DragEvent {
  override dataTransfer: DataTransfer | null
  override clientX: number
  override clientY: number

  constructor(
    type: string,
    { dataTransfer, clientX, clientY }: DragEventInit = {}
  ) {
    super(type)
    this.dataTransfer = dataTransfer ?? null
    this.clientX = clientX ?? 0
    this.clientY = clientY ?? 0
  }
}
