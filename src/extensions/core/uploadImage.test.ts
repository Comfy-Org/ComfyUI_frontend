import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyExtension } from '@/types/comfy'

interface CapturedExtension {
  name: string
  beforeRegisterNodeDef?: ComfyExtension['beforeRegisterNodeDef']
}

const registerExtension = vi.fn<(ext: CapturedExtension) => void>()

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: (ext: CapturedExtension) => registerExtension(ext)
  }
}))

let uploadImageExtension: CapturedExtension | undefined

beforeAll(async () => {
  await import('./uploadImage')
  uploadImageExtension = registerExtension.mock.calls
    .map(([ext]) => ext)
    .find((ext) => ext.name === 'Comfy.UploadImage')
})

describe('Comfy.UploadImage extension', () => {
  it('attaches an IMAGEUPLOAD widget when the image input declares image_upload', () => {
    const nodeData = {
      name: 'LoadImage',
      input: {
        required: {
          image: ['COMBO', { image_upload: true }]
        }
      }
    }

    uploadImageExtension!.beforeRegisterNodeDef!(
      undefined as unknown as typeof LGraphNode,
      nodeData as never,
      undefined as never
    )

    const upload = (nodeData.input.required as Record<string, unknown>).upload
    expect(upload).toBeDefined()
    expect((upload as [string, { imageInputName: string }])[0]).toBe(
      'IMAGEUPLOAD'
    )
    expect(
      (upload as [string, { imageInputName: string }])[1].imageInputName
    ).toBe('image')
  })

  it('attaches an IMAGEUPLOAD widget for LoadImage even when the backend omits image_upload', () => {
    // Reproduces the cloud bug: the cloud backend serves LoadImage without
    // image_upload: true on the image input, so Comfy.UploadImage skips
    // attaching the IMAGEUPLOAD widget. That cascade leaves node.pasteFiles
    // unset, which hides the right-click "Paste Image" menu item on cloud.
    const nodeData = {
      name: 'LoadImage',
      input: {
        required: {
          image: ['COMBO', {}]
        }
      }
    }

    uploadImageExtension!.beforeRegisterNodeDef!(
      undefined as unknown as typeof LGraphNode,
      nodeData as never,
      undefined as never
    )

    const upload = (nodeData.input.required as Record<string, unknown>).upload
    expect(upload).toBeDefined()
    expect(
      (upload as [string, { imageInputName: string; image_upload: boolean }])[0]
    ).toBe('IMAGEUPLOAD')
    const opts = (
      upload as [string, { imageInputName: string; image_upload: boolean }]
    )[1]
    expect(opts.imageInputName).toBe('image')
    expect(opts.image_upload).toBe(true)
  })

  it('attaches an IMAGEUPLOAD widget for LoadVideo with video_upload synthesized', () => {
    // Without injecting video_upload, useImageUploadWidget would default to
    // image-only filters and reject pasted/dropped video files on cloud.
    const nodeData = {
      name: 'LoadVideo',
      input: {
        required: {
          file: ['COMBO', {}]
        }
      }
    }

    uploadImageExtension!.beforeRegisterNodeDef!(
      undefined as unknown as typeof LGraphNode,
      nodeData as never,
      undefined as never
    )

    const upload = (nodeData.input.required as Record<string, unknown>).upload
    expect(upload).toBeDefined()
    expect(
      (upload as [string, { imageInputName: string; video_upload: boolean }])[0]
    ).toBe('IMAGEUPLOAD')
    const opts = (
      upload as [string, { imageInputName: string; video_upload: boolean }]
    )[1]
    expect(opts.imageInputName).toBe('file')
    expect(opts.video_upload).toBe(true)
  })

  it('does not touch LoadAudio — audio is handled by Comfy.UploadAudio', () => {
    // Routing audio through the IMAGEUPLOAD widget would reject every pasted
    // or dropped audio file. Comfy.UploadImage must stay out of LoadAudio.
    const nodeData = {
      name: 'LoadAudio',
      input: {
        required: {
          audio: ['COMBO', {}]
        }
      }
    }

    uploadImageExtension!.beforeRegisterNodeDef!(
      undefined as unknown as typeof LGraphNode,
      nodeData as never,
      undefined as never
    )

    expect(
      (nodeData.input.required as Record<string, unknown>).upload
    ).toBeUndefined()
  })

  it('never overwrites an upload widget another extension already attached', () => {
    // Comfy.UploadAudio is imported before Comfy.UploadImage and may have
    // already set required.upload = ['AUDIOUPLOAD', {}]. The fallback must
    // not clobber it on LoadAudio (or any future sibling uploader).
    const existingUpload = ['AUDIOUPLOAD', {}]
    const nodeData = {
      name: 'LoadAudio',
      input: {
        required: {
          audio: ['COMBO', {}],
          upload: existingUpload
        }
      }
    }

    uploadImageExtension!.beforeRegisterNodeDef!(
      undefined as unknown as typeof LGraphNode,
      nodeData as never,
      undefined as never
    )

    expect((nodeData.input.required as Record<string, unknown>).upload).toBe(
      existingUpload
    )
  })
})
