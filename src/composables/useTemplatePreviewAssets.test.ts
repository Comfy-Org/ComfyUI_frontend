import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MAX_GALLERY_IMAGES,
  useTemplatePreviewAssets
} from './useTemplatePreviewAssets'

let blobCounter = 0
const mockCreateObjectURL = vi.fn(
  () => `blob:http://localhost/mock-${++blobCounter}`
)
const mockRevokeObjectURL = vi.fn()

URL.createObjectURL = mockCreateObjectURL
URL.revokeObjectURL = mockRevokeObjectURL

function makeFile(name: string): File {
  return new File(['pixels'], name, { type: 'image/png' })
}

describe('useTemplatePreviewAssets', () => {
  let assets: ReturnType<typeof useTemplatePreviewAssets>

  beforeEach(() => {
    assets = useTemplatePreviewAssets()
    assets.clearAll()
    vi.clearAllMocks()
    blobCounter = 0
  })

  describe('single-asset slots', () => {
    it('setThumbnail caches the file and returns a blob URL', () => {
      const file = makeFile('thumb.png')
      const url = assets.setThumbnail(file)

      expect(url).toMatch(/^blob:/)
      expect(assets.thumbnail.value).not.toBeNull()
      expect(assets.thumbnail.value!.originalName).toBe('thumb.png')
      expect(assets.thumbnail.value!.file.name).toBe(file.name)
    })

    it('setThumbnail revokes the previous blob URL', () => {
      assets.setThumbnail(makeFile('a.png'))
      const firstUrl = assets.thumbnail.value!.objectUrl

      assets.setThumbnail(makeFile('b.png'))

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(firstUrl)
    })

    it('clearThumbnail revokes and nullifies', () => {
      assets.setThumbnail(makeFile('thumb.png'))
      const url = assets.thumbnail.value!.objectUrl

      assets.clearThumbnail()

      expect(assets.thumbnail.value).toBeNull()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url)
    })

    it('clearThumbnail is safe to call when empty', () => {
      expect(() => assets.clearThumbnail()).not.toThrow()
      expect(assets.thumbnail.value).toBeNull()
    })

    it('setBeforeImage and setAfterImage operate independently', () => {
      assets.setBeforeImage(makeFile('before.png'))
      assets.setAfterImage(makeFile('after.png'))

      expect(assets.beforeImage.value!.originalName).toBe('before.png')
      expect(assets.afterImage.value!.originalName).toBe('after.png')
    })

    it('setVideoPreview caches a video file', () => {
      const video = new File(['frames'], 'demo.mp4', { type: 'video/mp4' })
      assets.setVideoPreview(video)

      expect(assets.videoPreview.value!.originalName).toBe('demo.mp4')
    })

    it('setWorkflowPreview caches an image file', () => {
      assets.setWorkflowPreview(makeFile('graph.png'))

      expect(assets.workflowPreview.value!.originalName).toBe('graph.png')
    })
  })

  describe('gallery', () => {
    it('addGalleryImage appends to the gallery and returns the URL', () => {
      const url = assets.addGalleryImage(makeFile('output1.png'))

      expect(url).toMatch(/^blob:/)
      expect(assets.galleryImages.value).toHaveLength(1)
      expect(assets.galleryImages.value[0].originalName).toBe('output1.png')
    })

    it('addGalleryImage returns null when gallery is full', () => {
      for (let i = 0; i < MAX_GALLERY_IMAGES; i++) {
        assets.addGalleryImage(makeFile(`img${i}.png`))
      }

      const result = assets.addGalleryImage(makeFile('overflow.png'))

      expect(result).toBeNull()
      expect(assets.galleryImages.value).toHaveLength(MAX_GALLERY_IMAGES)
    })

    it('removeGalleryImage removes by index and revokes its URL', () => {
      assets.addGalleryImage(makeFile('a.png'))
      assets.addGalleryImage(makeFile('b.png'))
      assets.addGalleryImage(makeFile('c.png'))
      const removedUrl = assets.galleryImages.value[1].objectUrl

      assets.removeGalleryImage(1)

      expect(assets.galleryImages.value).toHaveLength(2)
      expect(assets.galleryImages.value.map((a) => a.originalName)).toEqual([
        'a.png',
        'c.png'
      ])
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(removedUrl)
    })

    it('removeGalleryImage is safe with out-of-range index', () => {
      assets.addGalleryImage(makeFile('a.png'))

      expect(() => assets.removeGalleryImage(99)).not.toThrow()
      expect(assets.galleryImages.value).toHaveLength(1)
    })
  })

  describe('clearAll', () => {
    it('revokes all blob URLs and resets all slots', () => {
      assets.setThumbnail(makeFile('thumb.png'))
      assets.setBeforeImage(makeFile('before.png'))
      assets.setAfterImage(makeFile('after.png'))
      assets.setVideoPreview(new File(['v'], 'vid.mp4', { type: 'video/mp4' }))
      assets.setWorkflowPreview(makeFile('graph.png'))
      assets.addGalleryImage(makeFile('g1.png'))
      assets.addGalleryImage(makeFile('g2.png'))

      vi.clearAllMocks()
      assets.clearAll()

      expect(assets.thumbnail.value).toBeNull()
      expect(assets.beforeImage.value).toBeNull()
      expect(assets.afterImage.value).toBeNull()
      expect(assets.videoPreview.value).toBeNull()
      expect(assets.workflowPreview.value).toBeNull()
      expect(assets.galleryImages.value).toEqual([])
      // 5 single slots + 2 gallery = 7 revocations
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(7)
    })
  })

  it('MAX_GALLERY_IMAGES is 6', () => {
    expect(MAX_GALLERY_IMAGES).toBe(6)
  })
})
