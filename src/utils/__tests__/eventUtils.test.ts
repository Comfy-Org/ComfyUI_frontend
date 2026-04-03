import {
  extractFilesFromDragEvent,
  hasAudioType,
  hasImageType,
  hasVideoType,
  isMediaFile
} from '@/utils/eventUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('eventUtils', () => {
  describe('extractFilesFromDragEvent', () => {
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })
    it('should return empty array when no dataTransfer', async () => {
      const actual = await extractFilesFromDragEvent(new FakeDragEvent('drop'))
      expect(actual).toEqual([])
    })

    it('should return empty array when dataTransfer has no files', async () => {
      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer: new DataTransfer() })
      )
      expect(actual).toEqual([])
    })

    it('should return single file from dataTransfer', async () => {
      const file = new File([new Uint8Array()], 'workflow.json', {
        type: 'application/json'
      })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)

      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer })
      )
      expect(actual).toEqual([file])
    })

    it('should return multiple files from dataTransfer', async () => {
      const file1 = new File([new Uint8Array()], 'workflow1.json', {
        type: 'application/json'
      })
      const file2 = new File([new Uint8Array()], 'workflow2.json', {
        type: 'application/json'
      })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file1)
      dataTransfer.items.add(file2)

      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer })
      )
      expect(actual).toEqual([file1, file2])
    })

    it('should filter out bmp files', async () => {
      const jsonFile = new File([new Uint8Array()], 'workflow.json', {
        type: 'application/json'
      })
      const bmpFile = new File([new Uint8Array()], 'image.bmp', {
        type: 'image/bmp'
      })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(jsonFile)
      dataTransfer.items.add(bmpFile)

      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer })
      )
      expect(actual).toEqual([jsonFile])
    })

    it('should return multiple image files from dataTransfer', async () => {
      const imageFile1 = new File([new Uint8Array()], 'image1.png', {
        type: 'image/png'
      })
      const imageFile2 = new File([new Uint8Array()], 'image2.jpg', {
        type: 'image/jpeg'
      })

      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(imageFile1)
      dataTransfer.items.add(imageFile2)

      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer })
      )
      expect(actual).toEqual([imageFile1, imageFile2])
    })

    it('should return multiple non-image files from dataTransfer', async () => {
      const file1 = new File([new Uint8Array()], 'file1.txt', {
        type: 'text/plain'
      })
      const file2 = new File([new Uint8Array()], 'file2.txt', {
        type: 'text/plain'
      })

      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file1)
      dataTransfer.items.add(file2)

      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer })
      )
      expect(actual).toEqual([file1, file2])
    })

    it('should fetch URI and return as File when text/uri-list is present', async () => {
      const uri = 'https://example.com/api/view?filename=test.png&type=input'
      const imageBlob = new Blob([new Uint8Array([0x89, 0x50])], {
        type: 'image/png'
      })
      fetchSpy.mockResolvedValue(new Response(imageBlob))

      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/uri-list', uri)

      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer })
      )

      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(actual).toHaveLength(1)
      expect(actual[0]).toBeInstanceOf(File)
      expect(actual[0].type).toBe('image/png')
    })

    it('should handle text/x-moz-url type', async () => {
      const uri = 'https://example.com/api/view?filename=test.png&type=input'
      const imageBlob = new Blob([new Uint8Array([0x89, 0x50])], {
        type: 'image/png'
      })
      fetchSpy.mockResolvedValue(new Response(imageBlob))

      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/x-moz-url', uri)

      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer })
      )

      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(actual).toHaveLength(1)
    })

    it('should return empty array when URI fetch fails', async () => {
      const uri = 'https://example.com/api/view?filename=test.png&type=input'
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))

      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/uri-list', uri)

      const actual = await extractFilesFromDragEvent(
        new FakeDragEvent('drop', { dataTransfer })
      )

      expect(actual).toEqual([])
    })
  })

  describe('media type helpers', () => {
    it('falls back to filename extension when image MIME type is empty', () => {
      const file = new File([''], 'example.jpg', { type: '' })
      expect(hasImageType(file)).toBe(true)
      expect(isMediaFile(file)).toBe(true)
    })

    it('falls back to filename extension when audio MIME type is empty', () => {
      const file = new File([''], 'example.mp3', { type: '' })
      expect(hasAudioType(file)).toBe(true)
      expect(isMediaFile(file)).toBe(true)
    })

    it('falls back to filename extension when video MIME type is empty', () => {
      const file = new File([''], 'example.mp4', { type: '' })
      expect(hasVideoType(file)).toBe(true)
      expect(isMediaFile(file)).toBe(true)
    })

    it('does not classify unknown extensions as media when MIME type is empty', () => {
      expect(isMediaFile(new File([''], 'example.bin', { type: '' }))).toBe(
        false
      )
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
