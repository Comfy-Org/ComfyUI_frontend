import {
  extractFilesFromDragEvent,
  fetchDroppedAsset,
  getDroppedAsset
} from '@/utils/eventUtils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('eventUtils', () => {
  describe('extractFilesFromDragEvent', () => {
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
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

  describe('getDroppedAsset', () => {
    it('returns the media-card name and URI before the URI is fetched', () => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        'application/x-comfy-asset-info',
        JSON.stringify({
          filename: 'asset.png',
          display_name: 'My asset',
          attachment_ref: 'stored-asset.png',
          media_kind: 'image',
          preview_url: 'http://localhost/api/assets/asset/content'
        })
      )
      dataTransfer.setData('text/uri-list', 'http://localhost/api/view?x=1')

      expect(getDroppedAsset(dataTransfer)).toEqual({
        name: 'My asset',
        uri: 'http://localhost/api/view?x=1',
        ref: 'stored-asset.png',
        kind: 'image',
        previewUrl: 'http://localhost/api/assets/asset/content'
      })
    })

    it('returns an existing attachment reference without requiring a URI', () => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        'application/x-comfy-asset-info',
        JSON.stringify({
          filename: 'asset.mp4',
          attachment_ref: 'stored-asset.mp4',
          media_kind: 'video'
        })
      )

      expect(getDroppedAsset(dataTransfer)).toEqual({
        name: 'asset.mp4',
        uri: undefined,
        ref: 'stored-asset.mp4',
        kind: 'video',
        previewUrl: undefined
      })
    })

    it('returns undefined when a Media card has no URI', () => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        'application/x-comfy-asset-info',
        JSON.stringify({ filename: 'asset.png' })
      )

      expect(getDroppedAsset(dataTransfer)).toBeUndefined()
    })

    it('passes an absolute preview URL through untouched', () => {
      const previewUrl = 'https://cloud.example/api/assets/a1/content'
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        'application/x-comfy-asset-info',
        JSON.stringify({ filename: 'a.png', preview_url: previewUrl })
      )
      dataTransfer.setData('text/uri-list', previewUrl)

      expect(getDroppedAsset(dataTransfer)?.previewUrl).toBe(previewUrl)
    })

    it('treats an empty attachment ref as no asset at all', () => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        'application/x-comfy-asset-info',
        JSON.stringify({ filename: 'a.png', attachment_ref: '' })
      )

      expect(getDroppedAsset(dataTransfer)).toBeUndefined()
    })
  })

  describe('fetchDroppedAsset', () => {
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
    })

    it('never fetches when the asset carries no URI', async () => {
      const actual = await fetchDroppedAsset({
        name: 'ref-only',
        ref: 'attachment-1'
      })

      expect(actual).toBeUndefined()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('round-trips a dropped asset into a named File', async () => {
      const blob = new Blob([new Uint8Array([0x89, 0x50])], {
        type: 'image/png'
      })
      fetchSpy.mockResolvedValue(new Response(blob))

      const actual = await fetchDroppedAsset({
        name: 'test.png',
        uri: 'https://example.com/view?f=test.png'
      })

      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(actual).toBeInstanceOf(File)
      expect(actual?.name).toBe('test.png')
      expect(actual?.type).toBe('image/png')
    })

    it('returns undefined for a non-OK response instead of wrapping the error body', async () => {
      fetchSpy.mockResolvedValue(
        new Response('not found', { status: 404, statusText: 'Not Found' })
      )

      const actual = await fetchDroppedAsset({
        name: 'missing.png',
        uri: 'https://example.com/view?f=missing.png'
      })

      expect(actual).toBeUndefined()
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
